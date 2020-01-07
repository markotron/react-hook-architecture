import React, {Dispatch, Reducer, ReducerAction, useEffect} from "react";

type Cleanup = () => void
type Effect<Substate> = (query: Substate) => Cleanup
type Query<State, Substate> = (state: State) => Substate | null
type FeedbackFactory =
    <State>(state: State) => <Substate>(query: Query<State, Substate>, effect: Effect<Substate>) => void

export const feedbackFactory: FeedbackFactory = <State>(state: State) => {
    return function <Substate>(query: Query<State, Substate>, effect: Effect<Substate>) {
        const q: Substate | null = query(state);
        useEffect(() => {
            if (q === null) return;
            return effect(q)
            // eslint-disable-next-line react-hooks/exhaustive-deps
        }, [q])
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

export type TypeFromCreator<T extends { [key: string]: (...args: any) => object }> = ReturnType<T[keyof T]>;

export function assertNever(state: never): never { throw Error(); }
