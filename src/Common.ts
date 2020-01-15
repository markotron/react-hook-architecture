import React, {Dispatch, Reducer, ReducerAction, useEffect} from "react";
import {fromEvent, merge, Observable} from "rxjs";
import {FromEventTarget} from "rxjs/internal/observable/fromEvent";

type Cleanup = () => void
type Effect<Substate> = (query: Substate) => Cleanup
type Query<State, Substate> = (state: State) => Substate | undefined
type FeedbackFactory =
    <State>(state: State) => <Substate>(query: Query<State, Substate>, effect: Effect<Substate>) => void

export const feedbackFactory: FeedbackFactory = <State>(state: State) => {
    return function <Substate>(query: Query<State, Substate>, effect: Effect<Substate>) {
        const q: Substate | undefined = query(state);
        useEffect(() => {
            if (q === undefined) return;
            return effect(q)
            // https://reactjs.org/docs/hooks-faq.html#is-it-safe-to-omit-functions-from-the-list-of-dependencies
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [JSON.stringify(q)]) // the comparison works by reference, that's why I'm stringifying it.
    }
};

export const getDispatchContext = <State, Action>() => React.createContext(getIdDispatcher<State, Action>());

const getIdDispatcher: <State, Action>() => Dispatch<ReducerAction<Reducer<State, Action>>> = () => _ => {
    throw Error("Using ID dispatcher!")
};

export const noop = () => {};
export function unsupported(msg: string): never {
    throw new Error(msg);
};
export function unsupportedAction<State, Action>(state: State, action: Action): never {
    unsupported(`Cannot dispatch action ${JSON.stringify(action)} while state is ${JSON.stringify(state)}`);
}
// I initially wrote this as "Symbol("unit")" but this cannot be stringified with JSON.stringify.
export const Unit = {};

// export type TypeFromCreator<T extends { [key: string]: (...args: any) => object }> = ReturnType<T[keyof T]>;

export function assertNever(_: never): never { throw Error(); }

/**
 * Rx helpers
 */
export function fromRefOrThrow<T>(el: FromEventTarget<T> | null, event: string) {
    return el ? fromEvent(el, event) : unsupported(`Element in null!`);
}

/**
 * Merges all the streams and dispatches the actions with the dispatcher.
 * @param dispatch -- dispatcher used to dispatch the action
 * @param events -- it's a function so that the evaluation happens when we call it.
 * @param query
 */
export function useEventStream<Action, Query>(
    dispatch: Dispatch<Action>,
    events: () => Array<Observable<Action>>,
    query?: Query | null
) {
    const deps = [JSON.stringify(query === undefined ? Unit : query)];
    useEffect(() => {
        if(query === null) return;
        const subscription = merge(...events()).subscribe(action => dispatch(action));
        return () => subscription.unsubscribe();
    }, deps)
}

