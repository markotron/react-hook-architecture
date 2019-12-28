import { ActionKind } from "./Constants";
import { Message } from "./Model";

export const errorOccurred = (errorMessage: string) => ({
  kind: ActionKind.ErrorOccurred, errorMessage,
} as const);

export const conversationLoaded = (messages: Array<Message>) => ({
  kind: ActionKind.ConversationLoaded, messages,
} as const);

export const messageSent = () => ({
  kind: ActionKind.MessageSent,
} as const);

export const newMessage = (message: Message) => ({
  kind: ActionKind.NewMessage, message,
} as const);

export const sendMessage = (message: Message) => ({
  kind: ActionKind.SendMessage, message,
} as const);
