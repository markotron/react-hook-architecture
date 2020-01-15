import {Message, UserId, Uuid} from "../model/Model";
import {Set} from "immutable";
import {Dispatch, Reducer} from "react";
import {assertNever, feedbackFactory, noop, Unit, unsupportedAction} from "../Common";
import messagingService from "../service/MessagingService";
import {Subscription, timer} from "rxjs";

// @formatter:off
/**
 * States
 */
export enum StateKind {
    LoadingConversation = "LoadingConversation",
    DisplayingMessages = "DisplayingMessages",
    DisplayingError = "DisplayingError",
}

export class LoadingConversation { kind = StateKind.LoadingConversation as const; }
export class DisplayingError {
    kind = StateKind.DisplayingError as const;
    constructor(
        readonly errorMessage: string,
        readonly retryInSec: number = 3,
    ) { }
}
export class DisplayingMessages {
    kind = StateKind.DisplayingMessages as const;
    constructor(
        readonly messages: Array<Message>,
        readonly loadMessagesBefore?: Uuid | null,
        readonly messageToSend?: Message,
        readonly messageToStar?: Message,
        readonly usersTyping: Set<UserId> = Set(),
        readonly lastReadMessageId: Uuid | null = null,
    ) { }
}

export type State = LoadingConversation | DisplayingError | DisplayingMessages
export const initialState = new LoadingConversation();

/**
 * Actions
 */
export enum ActionKind {
    ErrorOccurred = "ErrorOccurred",
    NewMessage = "NewMessage",
    ConversationLoaded = "ConversationLoaded",
    SendMessage = "SendMessage",
    MessageSent = "MessageSent",
    LoadOlderMessages = "LoadOlderMessages",
    OlderMessagesLoaded = "OlderMessagesLoaded",
    UserTyping = "UserTyping",
    AllMessagesRead = "AllMessagesRead",
    LastMessageReadFetched = "LastMessageReadFetched",
    StarMessage = "StarMessage",
    MessageStarred = "MessageStarred",
    Retry = "Retry",
}

export class ErrorOccurred {
    // `as const` is important because it ensures that the type is ErrorOccurred instead of ActionKind
    readonly kind = ActionKind.ErrorOccurred as const;
    constructor(readonly errorMessage: string) { }
}
export class ConversationLoaded { kind = ActionKind.ConversationLoaded as const; }
export class MessageSent { kind = ActionKind.MessageSent as const; }
export class NewMessage {
    kind = ActionKind.NewMessage as const;
    constructor(readonly message: Message) { }
}
export class SendMessage {
    kind = ActionKind.SendMessage as const;
    constructor(readonly message: Message) { }
}
export class LoadOlderMessages { kind = ActionKind.LoadOlderMessages as const; }
export class OlderMessagesLoaded {
    kind = ActionKind.OlderMessagesLoaded as const;
    constructor(readonly messages: Array<Message>) { }
}
export class UserTyping {
    kind = ActionKind.UserTyping as const;
    constructor(readonly isTyping: boolean, readonly userId?: UserId) { }
}
export class AllMessagesRead { kind = ActionKind.AllMessagesRead as const; }
export class LastMessageReadFetched {
    kind = ActionKind.LastMessageReadFetched as const;
    constructor(readonly messageId: Uuid) { }
}
export class StarMessage {
    kind = ActionKind.StarMessage as const;
    constructor(readonly message: Message) { }
}
export class MessageStarred { kind = ActionKind.MessageStarred as const; }
export class Retry {
    kind = ActionKind.Retry as const;
    constructor(readonly seconds: number) {}
}

export type Action = ErrorOccurred | ConversationLoaded | MessageSent | NewMessage |
    SendMessage | LoadOlderMessages | OlderMessagesLoaded | UserTyping |
    AllMessagesRead | LastMessageReadFetched | StarMessage | MessageStarred |
    Retry

// @formatter:on
/**
 * Reducer
 */
export const reducerWithProps: (me: UserId) => Reducer<State, Action> = (me) => (state: State, action: Action) => {

    const assertAndDo = (block: (state: DisplayingMessages) => State) =>
        state.kind === StateKind.DisplayingMessages ? block(state) : unsupportedAction(state, action);
    const assertAndCopy = (getProps: (state: DisplayingMessages) => Partial<DisplayingMessages>) =>
        assertAndDo((s) => s.copy(getProps(s)));

    const R = () => {
        switch (action.kind) {
            case ActionKind.Retry:
                return  state.kind !== StateKind.DisplayingError
                    ? unsupportedAction(state, action)
                    : action.seconds === 0
                    ? initialState
                    : new DisplayingError(state.errorMessage, state.retryInSec-1);
            case ActionKind.ErrorOccurred:
                return new DisplayingError(action.errorMessage);
            case ActionKind.ConversationLoaded:
                return state.kind === StateKind.LoadingConversation ?
                    new DisplayingMessages([], null) : unsupportedAction(state, action);
            case ActionKind.MessageSent:
                return assertAndCopy(_ => ({messageToSend: undefined}));
            case ActionKind.NewMessage:
                return assertAndCopy((s) => ({messages: [...s.messages, action.message]}));
            case ActionKind.SendMessage:
                return assertAndCopy(_ => ({messageToSend: {...action.message, userId: me}}));
            case ActionKind.LoadOlderMessages:
                return assertAndCopy((s) => ({loadMessagesBefore: s.messages[0]?.id}));
            case ActionKind.OlderMessagesLoaded:
                return assertAndCopy((s) => ({
                    messages: [...action.messages, ...s.messages], loadMessagesBefore: undefined
                }));
            case ActionKind.UserTyping:
                return assertAndDo((s) => s.updateTyping(action.userId ?? me, action.isTyping));
            case ActionKind.AllMessagesRead:
                return assertAndDo((s) => s.updateLastMessageRead());
            case ActionKind.LastMessageReadFetched:
                return assertAndCopy(_ => ({lastReadMessageId: action.messageId}));
            case ActionKind.MessageStarred:
                return assertAndDo((s) => s.messageStarred());
            case ActionKind.StarMessage:
                return assertAndCopy(_ => ({messageToStar: action.message}));
            default:
                assertNever(action);
        }
    };
    const newState = R();
    const now = new Date();
    const time = `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`;
    console.log(`[${time}] State: ${state.kind}, action: ${action.kind} => new state: ${newState.kind}`);
    return newState;
};

/**
 * Feedbacks
 */
export const useFeedbacks = (me: UserId, state: State, dispatch: Dispatch<Action>) => {

    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.kind === StateKind.DisplayingError ? s.retryInSec : undefined,
        seconds => {
            // const subscription = timer(seconds * 1000).subscribe(_ => dispatch(new Retry()));
            const subscription = timer(1000).subscribe(_ => dispatch(new Retry(seconds)));
            return () => subscription.unsubscribe();
        }
    );
    useFeedback(
        s => s.kind === StateKind.LoadingConversation || s.kind === StateKind.DisplayingMessages ? Unit : undefined,
        _ => {
            messagingService.connect();
            messagingService.onConnect(() => {
                    console.log("Conncted!");
                    dispatch(new ConversationLoaded());
                }
            );
            messagingService.onDisconnect(() => dispatch(new ErrorOccurred("Disconnected!")));
            messagingService.onNewMessage((message: Message) => dispatch(new NewMessage(message)));
            messagingService.onUserTyping((userId, isTyping) => dispatch(new UserTyping(isTyping, userId)));
            return () => messagingService.disconnect();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.messageToSend : undefined,
        message => {
            messagingService.sendMessage(message);
            dispatch(new MessageSent());
            return noop;
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.loadMessagesBefore : undefined,
        uuid => {
            const subscription = messagingService
                .fetchMessages(me, uuid)
                .subscribe(
                    (messages: Array<Message>) => dispatch(new OlderMessagesLoaded(messages)),
                    (reason: any) => dispatch(new ErrorOccurred(reason))
                );
            return () => subscription.unsubscribe();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.usersTyping.contains(me) : undefined,
        amITyping => {
            messagingService.sendUserTyping(me, amITyping);
            return noop;
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.lastReadMessageId : undefined,
        lastReadMessageId => {
            let subscription: Subscription | null = null;
            if (lastReadMessageId === null) {
                subscription = messagingService
                    .fetchLastReadMessage(me)
                    .subscribe(
                        (uuid: Uuid) => uuid !== null && dispatch(new LastMessageReadFetched(uuid.toString())),
                        (reason: any) => dispatch(new ErrorOccurred(reason.toString()))
                    );
            } else {
                messagingService.markMessagesAsRead(me, lastReadMessageId);
            }
            return () => subscription?.unsubscribe();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.messageToStar : undefined,
        messageToStar => {
            messagingService.markMessageAsStarred(me, messageToStar.id);
            messagingService.newFavorite({...messageToStar, isStarred: !messageToStar.isStarred});
            dispatch(new MessageStarred());
            return noop
        }
    );
};

/**
 * Extensions
 */
declare module "./StateMachine" {
    interface DisplayingMessages {
        copy: (props: Partial<DisplayingMessages>) => DisplayingMessages
        updateTyping: (id: UserId, isTyping: boolean) => DisplayingMessages
        updateLastMessageRead: () => DisplayingMessages
        messageStarred: () => DisplayingMessages
    }
}
DisplayingMessages.prototype.copy = function (props) { // should be something like PartialProperties<DisplayMessages>
    // Copying classes is hard.
    return Object.assign(Object.create(Object.getPrototypeOf(this)), {...this, ...props});
};
DisplayingMessages.prototype.updateTyping = function (id, isTyping) {
    return this.copy({usersTyping: isTyping ? this.usersTyping.add(id) : this.usersTyping.remove(id)});
};
DisplayingMessages.prototype.updateLastMessageRead = function () {
    const length = this.messages.length;
    if (length === 0) return this;
    const lastReadMessage = this.messages[this.messages.length - 1];
    return this.copy({lastReadMessageId: lastReadMessage.id})
};
DisplayingMessages.prototype.messageStarred = function () {
    const messageToStar = this.messageToStar;
    if (messageToStar === undefined) return this;
    const message = {...messageToStar, isStarred: !messageToStar.isStarred} as Message;
    const messageToStarId = message.id;
    const messageToStarIndex = this.messages.findIndex((m) => m.id === messageToStarId);
    const beforeMessageToStar = this.messages.slice(0, messageToStarIndex);
    const afterMessageToStar = this.messages.slice(messageToStarIndex + 1, this.messages.length);
    const newMessages = [...beforeMessageToStar, message, ...afterMessageToStar];
    return this.copy({messages: newMessages, messageToStar: undefined});
};
