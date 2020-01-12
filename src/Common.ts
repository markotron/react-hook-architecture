import React, {Dispatch, Reducer, ReducerAction, useEffect} from "react";

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
export function unsupportedAction<State, Action>(state: State, action: Action): never {
    throw Error(`Cannot dispatch action ${JSON.stringify(action)} while state is ${JSON.stringify(state)}`);
}
export const Unit = Symbol("unit");

// export type TypeFromCreator<T extends { [key: string]: (...args: any) => object }> = ReturnType<T[keyof T]>;

export function assertNever(_: never): never { throw Error(); }


