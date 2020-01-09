import {Message, UserId, Uuid} from "./Model";
import {Set} from "immutable";
import {Dispatch, Reducer} from "react";
import {assertNever, feedbackFactory, noop, Unit, unsupportedAction} from "../Common";
import messagingService from "./MessagingService";
import {Subscription} from "rxjs";

// @formatter:off
/**
 * States
 */
export enum StateKind {
    LoadingConversation = "LoadingConversation",
    DisplayingMessages = "DisplayingMessages",
    DisplayingError = "DisplayingError"
}

export class LoadingConversation { kind = StateKind.LoadingConversation as const; }
export class DisplayingError {
    kind = StateKind.DisplayingError as const;
    constructor(readonly errorMessage: string) { }
}
export class DisplayingMessages {
    kind = StateKind.DisplayingMessages as const;
    constructor(
        readonly messages: Array<Message>,
        readonly loadMessagesBefore?: Uuid | null,
        readonly messageToSend?: Message,
        readonly messageToStar?: Message,
        readonly usersTyping: Set<UserId> = Set(),
        readonly lastReadMessageId?: Uuid,
    ) { }
    copy(props: Partial<DisplayingMessages>): DisplayingMessages { // should be something like PartialProperties<DisplayMessages>
        // Copying classes is hard.
        return Object.assign(Object.create(Object.getPrototypeOf(this)), {...this, ...props});
    }
    updateTyping(id: UserId, isTyping: boolean): DisplayingMessages {
        return this.copy({usersTyping: isTyping ? this.usersTyping.add(id) : this.usersTyping.remove(id)});
    }
    updateLastMessageRead(): DisplayingMessages {
        const length = this.messages.length;
        if(length === 0) return this;
        const lastReadMessage = this.messages[this.messages.length - 1];
        return this.copy({lastReadMessageId: lastReadMessage.id})
    }
    messageStarred(): DisplayingMessages {
        const messageToStar = this.messageToStar;
        if(messageToStar === undefined) return this;
        const message = {...messageToStar, isStarred: !messageToStar.isStarred};
        const messageToStarId = message.id;
        const messageToStarIndex = this.messages.findIndex((m) => m.id === messageToStarId);
        const beforeMessageToStar = this.messages.slice(0, messageToStarIndex);
        const afterMessageToStar = this.messages.slice(messageToStarIndex + 1, this.messages.length);
        const newMessages = [...beforeMessageToStar, message, ...afterMessageToStar];
        return this.copy({messages: newMessages, messageToStar: undefined});
    }
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
    AllMessagesRead = "LastMessageRead",
    LastMessageReadFetched = "LastMessageReadFetched",
    StarMessage = "StarMessage",
    MessageStarred = "MessageStarred",
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

export type Action = ErrorOccurred | ConversationLoaded | MessageSent | NewMessage |
    SendMessage | LoadOlderMessages | OlderMessagesLoaded | UserTyping |
    AllMessagesRead | LastMessageReadFetched | StarMessage | MessageStarred

// @formatter:on
/**
 * Reducer
 */
export const reducerWithProps: (me: UserId) => Reducer<State, Action> = (me) => (state: State, action: Action) => {

    const assertAndDo = (block: (state: DisplayingMessages) => State) =>
        state.kind === StateKind.DisplayingMessages ? block(state) : unsupportedAction(state, action);
    const assertAndCopy = (getProps: (state: DisplayingMessages) => Partial<DisplayingMessages>) =>
        assertAndDo((s) => s.copy(getProps(s)));

    switch (action.kind) {
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

/**
 * Feedbacks
 */
export const useFeedbacks = (me: UserId, state: State, dispatch: Dispatch<Action>) => {

    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.kind === StateKind.LoadingConversation || s.kind === StateKind.DisplayingMessages ? Unit : null,
        _ => {
            messagingService.connect();
            messagingService.onConnect(() => dispatch(new ConversationLoaded()));
            messagingService.onNewMessage((message: Message) => dispatch(new NewMessage(message)));
            messagingService.onUserTyping((userId, isTyping) => dispatch(new UserTyping(isTyping, userId)));
            return () => messagingService.disconnect()
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? (s.messageToSend ?? null) : null,
        message => {
            messagingService.sendMessage(message);
            dispatch(new MessageSent());
            return noop;
        }
    );
    useFeedback(
        s => {
            if (s.kind !== StateKind.DisplayingMessages) return null;
            if (s.loadMessagesBefore === undefined) return null;
            if (s.loadMessagesBefore === null) return undefined;
            return s.loadMessagesBefore;
        },
        uuid => {
            const subscription = messagingService
                .fetchMessagesBefore(me, uuid)
                .subscribe(
                    (messages: Array<Message>) => dispatch(new OlderMessagesLoaded(messages)),
                    (reason: any) => dispatch(new ErrorOccurred(reason))
                );
            return () => subscription.unsubscribe();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.usersTyping.contains(me) : null,
        amITyping => {
            messagingService.sendUserTyping(me, amITyping);
            return noop;
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.lastReadMessageId : null,
        lastReadMessageId => {
            let subscription: Subscription | null = null;
            if (lastReadMessageId === undefined) {
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
        s => s.kind === StateKind.DisplayingMessages ? s.messageToStar ?? null : null,
        messageToStar => {
            messagingService.markMessageAsStarred(me, messageToStar.id);
            dispatch(new MessageStarred());
            return noop
        }
    );
};
