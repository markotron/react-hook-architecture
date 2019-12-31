import React, {Reducer, useContext, useReducer, useState} from 'react';
import './App.css';

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
import Send from "@material-ui/icons/Send"
import * as io from "socket.io-client"
import { feedbackFactory, getDispatchContext, noop, Unit, ExtractAction } from "./Common"
import { ActionKind } from "./Constants";
import { Message, UserId } from "./Model";

import * as ActionCreators from "./ActionCreators";

const DispatchContext = getDispatchContext<State, Action>();

enum StateKind { LoadingConversation, DisplayingMessages, DisplayingError }
type ErrorState = { kind: StateKind.DisplayingError, errorMessage: string };
type LoadingState = { kind: StateKind.LoadingConversation };
type DisplayingState = { kind: StateKind.DisplayingMessages, messages: Array<Message>, messageToSend?: Message };
type State = LoadingState | DisplayingState | ErrorState

const errorState: (errorMessage: string) => ErrorState =
    errorMessage => ({kind: StateKind.DisplayingError, errorMessage: errorMessage});
const initialState: State = {kind: StateKind.LoadingConversation};


type Action = ExtractAction<typeof ActionCreators>;

// Dependencies
let socket: SocketIOClient.Socket | null = null;

const Chat: React.FC<{ me: UserId }> = ({me}) => {

    const reducer: Reducer<State, Action> = (state: State, action: Action) => {
        console.debug(`State: ${JSON.stringify(state)}, Action: ${JSON.stringify(action)}`);

        switch (action.kind) {
            case ActionKind.ErrorOccurred:
                return {kind: StateKind.DisplayingError, errorMessage: action.errorMessage};
            case ActionKind.MessageSent:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, messageToSend: undefined} :
                    errorState("MessageSent");
            case ActionKind.NewMessage:
                return state.kind === StateKind.DisplayingMessages ?
                    {...state, messages: [...state.messages, action.message]} :
                    errorState("NewMessage");
            case ActionKind.SendMessage:
                return state.kind === StateKind.DisplayingMessages && !state.messageToSend ?
                    {...state, messageToSend: {...action.message, userId: me}} :
                    errorState("SendMessage");
            case ActionKind.ConversationLoaded:
                return state.kind === StateKind.LoadingConversation ?
                    {kind: StateKind.DisplayingMessages, messages: action.messages} :
                    errorState("ConversationLoaded");
        }
    };

    const [state, dispatch] = useReducer(reducer, initialState);
    const useFeedback = feedbackFactory(state);
    useFeedback(
        s => s.kind === StateKind.LoadingConversation || s.kind === StateKind.DisplayingMessages ? Unit : null,
        _ => {
            socket = io.connect("http://localhost:5000");
            socket.on("connect", () => dispatch(ActionCreators.conversationLoaded([])));
            socket.on("chat message", (message: Message) => dispatch(ActionCreators.newMessage(message)));
            return () => socket?.close();
        }
    );
    useFeedback(
        s => s.kind === StateKind.DisplayingMessages ? (s.messageToSend ?? null) : null,
        message => {
            socket?.emit("chat message", message);
            dispatch(ActionCreators.messageSent());
            return noop;
        }
    );
    // UI
    const classes = useStyles();

    function getMessagesUI(messages: Array<Message>) {
        return (
            <React.Fragment>
                {messages.map(m => <ChatMessage key={m.id}
                                                message={m.message}
                                                align={m.userId === me ? 'right' : 'left'}/>)}
            </React.Fragment>
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
                return getMessagesUI(state.messages);
            case StateKind.DisplayingError:
                return getErrorUI(state.errorMessage);
        }
    }

    return (
        <DispatchContext.Provider value={dispatch}>
            <Container fixed maxWidth="xs" className={clsx(classes.boxed)}>
                <CssBaseline/>
                {content(state)}
                <ChatInput/>
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

function ChatInput() {

    // UI State
    const [message, setMessage] = useState("");
    const classes = useStyles();

    // Global dispatcher
    const dispatch = useContext(DispatchContext);

    const sendMessage = () => {
        const messageToSend = message.trim(); // does this shit trim in place? NO
        if (messageToSend === '') return;
        dispatch(ActionCreators.sendMessage({ id: uuid(), message: messageToSend }));
        setMessage("");
    };

    return (
        <FormControl className={clsx(classes.marginBottom, classes.textField)}>
            <InputLabel htmlFor="message">Message</InputLabel>
            <Input
                id="message"
                type='text'
                value={message}
                onChange={(e) => setMessage(e.target.value)}
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
}

function randUser() {
    return Math.round(Math.random() * 10000);
}

function App() {
    return <Chat me={randUser()}/>
}

export default App;
