import {Message, UserId, Uuid} from "./Model";
import {Set} from "immutable";
import {Reducer} from "react";
import {assertNever, unsupportedAction} from "../Common";

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
    constructor(public errorMessage: string) { }
}
export class DisplayingMessages {
    kind = StateKind.DisplayingMessages as const;
    constructor(
        public messages: Array<Message>,
        public loadMessagesBefore?: Uuid | null,
        public messageToSend?: Message,
        public usersTyping: Set<UserId> = Set(),
    ) { }
    copy(props: Partial<DisplayingMessages>): DisplayingMessages { // should be something like PartialProperties<DisplayMessages>
        // Copying classes is hard.
        return Object.assign(Object.create(Object.getPrototypeOf(this)), {...this, ...props});
    }
    updateTyping(id: UserId, isTyping: boolean): DisplayingMessages {
        return this.copy({usersTyping: isTyping ? this.usersTyping.add(id) : this.usersTyping.remove(id)});
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
}

export class ErrorOccured {
    // `as const` is important because it ensures that the type is ErrorOccurred instead of ActionKind
    kind = ActionKind.ErrorOccurred as const;
    constructor(public errorMessage: string) { }
}
export class ConversationLoaded { kind = ActionKind.ConversationLoaded as const; }
export class MessageSent { kind = ActionKind.MessageSent as const; }
export class NewMessage {
    kind = ActionKind.NewMessage as const;
    constructor(public message: Message) { }
}
export class SendMessage {
    kind = ActionKind.SendMessage as const;
    constructor(public message: Message) { }
}
export class LoadOlderMessages { kind = ActionKind.LoadOlderMessages as const; }
export class OlderMessagesLoaded {
    kind = ActionKind.OlderMessagesLoaded as const;
    constructor(public messages: Array<Message>) { }
}
export class UserTyping {
    kind = ActionKind.UserTyping as const;
    constructor(public isTyping: boolean, public userId?: UserId) { }
}

export type Action = ErrorOccured | ConversationLoaded | MessageSent | NewMessage |
    SendMessage | LoadOlderMessages | OlderMessagesLoaded | UserTyping

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
        case ActionKind.MessageSent:
            return assertAndCopy(_ => ({messageToSend: undefined}));
        case ActionKind.NewMessage:
            return assertAndCopy((s) => ({messages: [...s.messages, action.message]}));
        case ActionKind.SendMessage:
            return assertAndCopy(_ => ({messageToSend: {...action.message, userId: me}}));
        case ActionKind.ConversationLoaded:
            return state.kind === StateKind.LoadingConversation ?
                new DisplayingMessages([], null) : unsupportedAction(state, action);
        case ActionKind.LoadOlderMessages:
            return assertAndCopy((s) => ({loadMessagesBefore: s.messages[0]?.id}));
        case ActionKind.OlderMessagesLoaded:
            return assertAndCopy((s) => ({
                messages: [...action.messages, ...s.messages], loadMessagesBefore: undefined
            }));
        case ActionKind.UserTyping:
            return assertAndDo((s) => s.updateTyping(action.userId ?? me, action.isTyping));
        default:
            assertNever(action);
    }
};

