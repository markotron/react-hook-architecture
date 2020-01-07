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
import {assertNever, getDispatchContext} from "../Common"
import {Message, UserId} from "./Model";
import React, {useContext, useReducer, useState} from 'react';
import {Set} from "immutable";
import {
    Action,
    initialState,
    LoadOlderMessages,
    reducerWithProps,
    SendMessage,
    State,
    StateKind,
    useFeedbacks,
    UserTyping
} from "./StateMachine";

const DispatchContext = getDispatchContext<State, Action>();

export const Chat: React.FC<{ me: UserId }> = ({me}) => {

    const [state, dispatch] = useReducer(reducerWithProps(me), initialState);
    useFeedbacks(me, state, dispatch);

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
                assertNever(state);
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
                    onClick={() => dispatch(new LoadOlderMessages())}>
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
        dispatch(new SendMessage({id: uuid(), message: messageToSend}));
        dispatch(new UserTyping(false));
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
                    dispatch(new UserTyping(text !== ""));
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
