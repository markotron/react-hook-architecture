export type Uuid = string;
export type UserId = number;

export interface Message {
    id: Uuid;
    userId?: UserId;
    message: string;
    isStarred: boolean
}
