export type Uuid = string;
export type UserId = number;

export interface Message {
    readonly id: Uuid
    readonly userId?: UserId
    readonly message: string
    readonly isStarred: boolean
}

export interface User {
    readonly id: UserId
    readonly name: string
}

export function isUser(o: any): o is User {
    return o instanceof Object && 'id' in o && 'name' in o;
}
