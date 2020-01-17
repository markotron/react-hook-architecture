import {isUser, Message, User, UserId, Uuid} from "../model/Model";
import {Dispatch, Reducer} from "react";
import {assertNever, feedbackFactory, noop, Unit} from "../Common";
import messagingService from "../service/MessagingService";
import userService from "../service/UserService";

// @formatter:off
export class State {
    constructor(
        readonly user: User | UserId,
        readonly messages: Array<Message>,
        readonly loadMessagesBefore?: Uuid | null,
        readonly error?: string
    ) {}
}
export const initialState = (id: UserId) => new State(id, [], null);

export enum ActionKind {
    UserLoaded = "UserLoaded",
    LoadOlderMessages = "LoadOlderMessages",
    OlderMessagesLoaded = "OlderMessagesLoaded",
    NewFavorite = "NewFavorite",
    ErrorOccurred = "ErrorOccurred",
}
export class LoadOlderMessages { readonly kind = ActionKind.LoadOlderMessages as const; }
export class UserLoaded {
    readonly kind = ActionKind.UserLoaded as const;
    constructor(readonly user: User) { }
}
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

export type Action = LoadOlderMessages | OlderMessagesLoaded | ErrorOccurred | NewFavorite |
    UserLoaded
// @formatter:on

export const reducerWithProps: Reducer<State, Action> = (state, action) => {
    switch (action.kind) {
        case ActionKind.UserLoaded:
            return new State(action.user, state.messages, state.loadMessagesBefore);
        case ActionKind.NewFavorite:
            return state.toggleFavorite(action.message);
        case ActionKind.LoadOlderMessages:
            return new State(state.user, state.messages, state.messages[0]?.id);
        case ActionKind.OlderMessagesLoaded:
            return new State(state.user, [...action.messages, ...state.messages], undefined);
        case ActionKind.ErrorOccurred:
            return new State(state.user, state.messages, undefined, action.errorMessage);
        default:
            assertNever(action)
    }
};

export const useFeedbacks = (me: UserId, state: State, dispatch: Dispatch<Action>) => {
    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.user,
        userOrId => {
            if(isUser(userOrId)) return noop;
            const subscription = userService
                .getUserWithId(userOrId)
                .subscribe(user => dispatch(new UserLoaded(user)));
            return () => subscription.unsubscribe();
        }

    );
    useFeedback(
        s => s.loadMessagesBefore,
        uuid => {
            const subscription = messagingService
                .fetchStarredMessages(me, uuid)
                .subscribe(
                    (messages: Array<Message>) => dispatch(new OlderMessagesLoaded(messages)),
                    (reason: any) => dispatch(new ErrorOccurred(reason.message))
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
        new State(this.user, [...this.messages, favorite], this.loadMessagesBefore, this.error) :
        new State(this.user, this.messages.filter((m) => m.id !== favorite.id), this.loadMessagesBefore, this.error);
};
