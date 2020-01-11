import {Message, UserId, Uuid} from "../model/Model";
import {Dispatch, Reducer} from "react";
import {assertNever, feedbackFactory, noop, Unit} from "../Common";
import messagingService from "../service/MessagingService";

// @formatter:off
export class State {
    constructor(
        readonly messages: Array<Message>,
        readonly loadMessagesBefore?: Uuid | null,
        readonly error?: string
    ) {}
}
export const initialState = new State([], null);

export enum ActionKind {
    LoadOlderMessages = "LoadOlderMessages",
    OlderMessagesLoaded = "OlderMessagesLoaded",
    NewFavorite = "NewFavorite",
    ErrorOccurred = "ErrorOccurred",
}
export class LoadOlderMessages { readonly kind = ActionKind.LoadOlderMessages as const; }
export class OlderMessagesLoaded {
    readonly kind = ActionKind.OlderMessagesLoaded as const;
    constructor(readonly messages: Array<Message>) {}
}
export class NewFavorite {
    readonly kind = ActionKind.NewFavorite as const;
    constructor(readonly message: Message) {}
}
export class ErrorOccurred {
    readonly kind = ActionKind.ErrorOccurred as const;
    constructor(readonly errorMessage: string) {}
}

export type Action = LoadOlderMessages | OlderMessagesLoaded | ErrorOccurred | NewFavorite
// @formatter:on

export const reducerWithProps: Reducer<State, Action> = (state, action) => {
    switch (action.kind) {
        case ActionKind.NewFavorite:
            return state.toggleFavorite(action.message);
        case ActionKind.LoadOlderMessages:
            return new State(state.messages, state.messages[0]?.id);
        case ActionKind.OlderMessagesLoaded:
            return new State([...action.messages, ...state.messages], undefined);
        case ActionKind.ErrorOccurred:
            return new State(state.messages, state.loadMessagesBefore, action.errorMessage);
        default:
            assertNever(action)
    }
};

export const useFeedbacks = (me: UserId, state: State, dispatch: Dispatch<Action>) => {
    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => {
            if (s.loadMessagesBefore === undefined) return null;
            if (s.loadMessagesBefore === null) return undefined;
            return s.loadMessagesBefore;
        },
        uuid => {
            const subscription = messagingService
                .fetchStarredMessages(me, uuid)
                .subscribe(
                    (messages: Array<Message>) => dispatch(new OlderMessagesLoaded(messages)),
                    (reason: any) => dispatch(new ErrorOccurred(reason))
                );
            return () => subscription.unsubscribe();
        }
    );
    useFeedback(
        _ => Unit,
        _ => {
            const subscription = messagingService
                .observeFavorites()
                .subscribe(message => dispatch(new NewFavorite(message)));
            return () => subscription.unsubscribe();
        }
    );
};

/**
 * Extensions.
 */
declare module "./StateMachine" {
    interface State {
        toggleFavorite: (favorite: Message) => State
    }
}
State.prototype.toggleFavorite = function(favorite: Message) {
    return favorite.isStarred ?
        new State([...this.messages, favorite], this.loadMessagesBefore, this.error) :
        new State(this.messages.filter((m) => m.id !== favorite.id), this.loadMessagesBefore, this.error);
};
