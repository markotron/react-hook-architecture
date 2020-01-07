import uuid from "uuid";
import {makeStyles} from "@material-ui/core";
import Container from "@material-ui/core/Container";
import CssBaseline from "@material-ui/core/CssBaseline";
import clsx from "clsx";
import FormControl from "@material-ui/core/FormControl";
import InputLabel from "@material-ui/core/InputLabel";
import Input from "@material-ui/core/Input";
import InputAdornment from "@material-ui/core/InputAdornment";
import IconButton from "@material-ui/core/IconButton";
import Button from "@material-ui/core/Button"
import Send from "@material-ui/icons/Send"
import * as io from "socket.io-client"
import {feedbackFactory, getDispatchContext, noop, safe, TypeFromCreator, Unit} from "../Common"
import {Message, UserId, Uuid} from "./Model";
import React, {Reducer, useContext, useReducer, useState} from 'react';
import {Set} from "immutable";

const DispatchContext = getDispatchContext<State, Action>();

enum StateKind { LoadingConversation, DisplayingMessages, DisplayingError}

const StateCreator = {
    errorState: (errorMessage: string) => ({kind: StateKind.DisplayingError, errorMessage} as const),
    loadingState: () => ({kind: StateKind.LoadingConversation} as const),
    displayingState: (
        messages: Array<Message>,
        messageToSend?: Message,
        loadMessagesBefore?: Uuid | null,
        usersTyping: Set<UserId> = Set(),
    ) => ({
        kind: StateKind.DisplayingMessages,
        messages,
        messageToSend,
        loadMessagesBefore,
        usersTyping,
    } as const),
};

enum ActionKind {
    ErrorOccurred,
    NewMessage,
    ConversationLoaded,
    SendMessage,
    MessageSent,
    LoadOlderMessages,
    OlderMessagesLoaded,
    UserTyping,
}

const ActionCreator = {
    errorOccurred: (errorMessage: string) => ({kind: ActionKind.ErrorOccurred, errorMessage,} as const),
    conversationLoaded: () => ({kind: ActionKind.ConversationLoaded,} as const),
    messageSent: () => ({kind: ActionKind.MessageSent,} as const),
    newMessage: (message: Message) => ({kind: ActionKind.NewMessage, message,} as const),
    sendMessage: (message: Message) => ({kind: ActionKind.SendMessage, message,} as const),
    loadOlderMessages: () => ({kind: ActionKind.LoadOlderMessages,} as const),
    olderMessagesLoaded: (messages: Array<Message>) => ({kind: ActionKind.OlderMessagesLoaded, messages} as const),
    userTyping: (typing: boolean, userId?: UserId) => ({kind: ActionKind.UserTyping, userId, typing} as const),
};
type State = TypeFromCreator<typeof StateCreator>
type Action = TypeFromCreator<typeof ActionCreator>

const initialState: State = StateCreator.loadingState();

const updateTyping = (usersTyping: Set<UserId>, id: UserId, typing: boolean) =>
    typing ? usersTyping.add(id) : usersTyping.delete(id);

// Dependencies
let socket: SocketIOClient.Socket | null = null;

export const Chat: React.FC<{ me: UserId }> = ({me}) => {

    const reducer: Reducer<State, Action> = (state: State, action: Action) => {
        console.debug(`State: ${JSON.stringify(state)}, Action: ${JSON.stringify(action)}`);

        switch (action.kind) {
            case ActionKind.ErrorOccurred:
                return {kind: StateKind.DisplayingError, errorMessage: action.errorMessage};
            case ActionKind.MessageSent:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, messageToSend: undefined} :
                    StateCreator.errorState("MessageSent");
            case ActionKind.NewMessage:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, messages: [...state.messages, action.message]} :
                    StateCreator.errorState("NewMessage");
            case ActionKind.SendMessage:
                return state.kind === StateKind.DisplayingMessages && !state.messageToSend ?
                    {...state, messageToSend: {...action.message, userId: me}} :
                    StateCreator.errorState("SendMessage");
            case ActionKind.ConversationLoaded:
                return state.kind === StateKind.LoadingConversation ?
                    StateCreator.displayingState([], undefined, null) :
                    StateCreator.errorState("ConversationLoaded");
            case ActionKind.LoadOlderMessages:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, loadMessagesBefore: state.messages[0]?.id} :
                    StateCreator.errorState("LoadOlderMessages");
            case ActionKind.OlderMessagesLoaded:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, messages: [...action.messages, ...state.messages], loadMessagesBefore: undefined} :
                    StateCreator.errorState("OlderMessagesLoaded");
            case ActionKind.UserTyping:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, usersTyping: updateTyping(state.usersTyping, action.userId ?? me, action.typing)} :
                    StateCreator.errorState("UserTyping");
        }
    };

    const [state, dispatch] = useReducer(reducer, initialState);
    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.kind === StateKind.LoadingConversation || s.kind === StateKind.DisplayingMessages ? Unit : null,
        _ => {
            socket = io.connect("http://localhost:5000");
            socket.on("connect", () => dispatch(ActionCreator.conversationLoaded()));
            socket.on("new-message", (message: Message) => dispatch(ActionCreator.newMessage(message)));
            socket.on("user-typing", ([id, typing]: [UserId, boolean]) => dispatch(ActionCreator.userTyping(typing, id)));
            return () => socket?.close();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? (s.messageToSend ?? null) : null,
        message => {
            socket?.emit("new-message", message);
            dispatch(ActionCreator.messageSent());
            return noop;
        }
    );
    useFeedback(
        s => {
            if (s.kind !== StateKind.DisplayingMessages) return null;
            if (s.loadMessagesBefore === undefined) return null;
            if (s.loadMessagesBefore === null) return Unit;
            return s.loadMessagesBefore
        },
        uuid => {
            const root = `http://localhost:5000/messages`;
            const suff = uuid === Unit ? "" : `?uuid=${uuid}`;
            fetch(root + suff)
            .then((res) => res.json())
            .then((res) => dispatch(ActionCreator.olderMessagesLoaded(res)))
            .catch((reason) => dispatch(ActionCreator.errorOccurred(reason)));
            return noop; // ideally we'd like to cancel this guy.
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? s.usersTyping.contains(me) : null,
        amITyping => {
            socket?.emit("user-typing", [me, amITyping]);
            return noop;
        }
    );
    // UI
    const classes = useStyles();

    function getMessagesUI(messages: Array<Message>, usersTyping: Set<UserId>) {
        return (
            <div>
                {messages.map(m => <ChatMessage key={m.id}
                                                message={m.message}
                                                align={m.userId === me ? 'right' : 'left'}/>)}
                <UsersTyping usersTyping={usersTyping} me={me}/>
            </div>
        );
    }

    function getErrorUI(message: string) {
        return (
            <React.Fragment>
                <ChatMessage message={message} align='left'/>
            </React.Fragment>
        )
    }

    function getLoadingUI() {
        return (
            <React.Fragment>
                <ChatMessage message='Loading...' align='left'/>
            </React.Fragment>
        )
    }

    function content(state: State) {
        switch (state.kind) {
            case StateKind.LoadingConversation:
                return getLoadingUI();
            case StateKind.DisplayingMessages:
                return getMessagesUI(state.messages, state.usersTyping);
            case StateKind.DisplayingError:
                return getErrorUI(state.errorMessage);
            default:
                safe(state);
        }
    }

    function isMessageToSend(state: State): boolean {
        return state.kind === StateKind.DisplayingMessages && !state.messageToSend
    }

    return (
        <DispatchContext.Provider value={dispatch}>
            <Container fixed maxWidth="xs" className={clsx(classes.boxed)}>
                <CssBaseline/>
                <div className={clsx(classes.right)}>
                    <h2>User ID: {me}</h2>
                </div>
                <Button
                    disabled={state.kind !== StateKind.DisplayingMessages || state.loadMessagesBefore != null}
                    variant="contained"
                    onClick={() => dispatch(ActionCreator.loadOlderMessages())}>
                    Load more
                </Button>
                {content(state)}
                <ChatInput enabled={isMessageToSend(state)}/>
            </Container>
        </DispatchContext.Provider>
    );
};

const useStyles = makeStyles(theme => ({
    root: {
        display: 'flex',
        flexWrap: 'wrap',
    },
    marginBottom: {
        marginBottom: theme.spacing(1),
    },
    withoutLabel: {
        marginTop: theme.spacing(3),
    },
    textField: {
        width: "100%",
    },
    boxed: {
        marginTop: theme.spacing(1),
    },
    messageBox: {
        marginTop: theme.spacing(1),
        marginBottom: theme.spacing(1),
    },
    right: {
        float: "right",
        clear: "both",
    },
    left: {
        float: "left",
        clear: "both",
    },
    message: {
        padding: theme.spacing(2),
        borderRadius: "10px",
        color: "white",
        backgroundColor: "#3b5998",
        display: "inline-block",
    },
}));

const ChatMessage: React.FC<{ message: string, align: string }> = ({message, align}) => {
    const classes = useStyles();
    const applyClasses = () => align === 'left' ? clsx(classes.messageBox, classes.left) : clsx(classes.messageBox, classes.right);
    return (
        <div className={applyClasses()}>
            <span className={clsx(classes.message)}>{message}</span>
        </div>
    );
};

const UsersTyping: React.FC<{ usersTyping: Set<UserId>, me: UserId }> = ({usersTyping, me}) => {
    const classes = useStyles();
    const usersWithoutMeTyping = usersTyping.filter((id => id !== me));
    if (usersWithoutMeTyping.isEmpty()) return null;
    return (
        <div className={clsx(classes.left)}>
            <p>Who is typing: {usersWithoutMeTyping.join(", ")}</p>
        </div>
    );
};

const ChatInput: React.FC<{ enabled: boolean }> = ({enabled}) => {

    // UI State
    const [message, setMessage] = useState("");
    const classes = useStyles();

    // Global dispatcher
    const dispatch = useContext(DispatchContext);

    const sendMessage = () => {
        const messageToSend = message.trim(); // does this shit trim in place? NO
        if (messageToSend === '') return;
        dispatch(ActionCreator.sendMessage({id: uuid(), message: messageToSend}));
        dispatch(ActionCreator.userTyping(false));
        setMessage("");
    };

    return (
        <FormControl className={clsx(classes.marginBottom, classes.textField)}>
            <InputLabel htmlFor="message">Message</InputLabel>
            <Input
                disabled={!enabled}
                id="message"
                type='text'
                value={message}
                onChange={(e) => {
                    const text = e.target.value;
                    setMessage(text);
                    dispatch(ActionCreator.userTyping(text !== ""));
                }}
                onKeyPress={(e) => e.key === 'Enter' ? sendMessage() : null}
                endAdornment={
                    <InputAdornment position="end">
                        <IconButton
                            aria-label="send"
                            onClick={sendMessage}
                        >
                            <Send/>
                        </IconButton>
                    </InputAdornment>
                }
            />
        </FormControl>
    );
};
