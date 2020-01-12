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
import {assertNever, fromRefOrThrow, getDispatchContext, useEventStream} from "../Common"
import {Message, UserId, Uuid} from "../model/Model";
import React, {ChangeEvent, RefObject, useContext, useReducer, useRef, useState} from 'react';
import {Set} from "immutable";
import {
    Action,
    AllMessagesRead,
    initialState,
    LoadOlderMessages,
    reducerWithProps,
    SendMessage,
    StarMessage,
    State,
    StateKind,
    useFeedbacks,
    UserTyping
} from "./StateMachine";
import {Autorenew, ChatBubble, Star} from "@material-ui/icons";
import {debounceTime, map, throttleTime} from "rxjs/operators";

const DispatchContext = getDispatchContext<State, Action>();

export const Chat: React.FC<{ me: UserId }> = ({me}) => {

    const [state, dispatch] = useReducer(reducerWithProps(me), initialState);
    useFeedbacks(me, state, dispatch);

    const classes = useStyles();

    function getMessagesUI(messages: Array<Message>, usersTyping: Set<UserId>, lastReadMessageId: Uuid | null, canStar = false) {
        const listOfMessages = (msgs: Array<Message>, areNew: boolean = false) =>
            msgs.map(m => <ChatMessage key={m.id}
                                       message={m}
                                       isNew={areNew && m.userId !== me}
                                       canStar={canStar}
                                       align={m.userId === me ? 'right' : 'left'}/>);
        const lastReadMessageSliceIndex = messages.findIndex((m) => m.id === lastReadMessageId) + 1;
        const readMessages = messages.slice(0, lastReadMessageSliceIndex);
        const unreadMessages = messages.slice(lastReadMessageSliceIndex, messages.length);
        return (
            <div>
                {listOfMessages(readMessages)}
                {listOfMessages(unreadMessages, true)}
                <UsersTyping usersTyping={usersTyping} me={me}/>
            </div>
        );
    }

    function getErrorUI(message: string) {
        return (
            <React.Fragment>
                <p>Message</p>
            </React.Fragment>
        )
    }

    function getLoadingUI() {
        return (
            <React.Fragment>
                <p>Loading...</p>
            </React.Fragment>
        )
    }

    function content(state: State) {
        switch (state.kind) {
            case StateKind.LoadingConversation:
                return getLoadingUI();
            case StateKind.DisplayingMessages:
                return getMessagesUI(state.messages, state.usersTyping, state.lastReadMessageId, state.messageToSend === undefined);
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
            <Container fixed maxWidth="md" className={clsx(classes.boxed)}>
                <CssBaseline/>
                <div className={clsx(classes.right)}>
                    <h2>User ID: {me}</h2>
                </div>
                <IconButton
                    disabled={state.kind !== StateKind.DisplayingMessages || state.loadMessagesBefore != null}
                    onClick={_ => dispatch(new LoadOlderMessages())}>
                    <Autorenew/>
                </IconButton>
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

const ChatMessage: React.FC<{ message: Message, isNew: boolean, align: string, canStar: boolean }> = ({message, isNew = true, align, canStar}) => {
    const classes = useStyles();
    const applyClasses = () => align === 'left' ? clsx(classes.messageBox, classes.left) : clsx(classes.messageBox, classes.right);
    const dispatch = useContext(DispatchContext);
    return (
        <div className={applyClasses()}>
            {align === 'left' && isNew && <IconButton disabled={true}>
                <ChatBubble visibility={0} color="primary"/>
            </IconButton>}
            <span className={clsx(classes.message)}>{message.message}</span>
            <IconButton
                disabled={!canStar}
                onClick={_ => dispatch(new StarMessage(message))}>
                <Star color={message.isStarred ? "primary" : "action"}/>
            </IconButton>
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

// const keyPressSubject = new Subject();
const ChatInput: React.FC<{ enabled: boolean }> = ({enabled}) => {

    // UI State
    const [message, setMessage] = useState("");
    const classes = useStyles();

    // Global dispatcher
    const dispatch = useContext(DispatchContext);

    const sendMessage = () => {
        const messageToSend = message.trim(); // does this shit trim in place? NO
        if (messageToSend === '') return;
        dispatch(new SendMessage({id: uuid(), message: messageToSend, isStarred: false}));
        dispatch(new UserTyping(false));
        dispatch(new AllMessagesRead());
        setMessage("");
    };

    const sendMessageRef: RefObject<HTMLInputElement> = useRef(null);

    type CE = ChangeEvent<HTMLInputElement>
    useEventStream(dispatch, () => [
        fromRefOrThrow<CE>(sendMessageRef.current, 'keyup')
            .pipe(
                throttleTime(1000),
                map(e => new UserTyping(e.target.value !== ""))
            ),
        fromRefOrThrow<CE>(sendMessageRef.current, 'keyup')
            .pipe(
                debounceTime(5000),
                map(_ => new UserTyping(false))
            )]
    );

    return (
        <FormControl className={clsx(classes.marginBottom, classes.textField)}>
            <InputLabel htmlFor="message">Message</InputLabel>
            <Input
                disabled={!enabled}
                id="message"
                type='text'
                value={message}
                onChange={e => setMessage(e.target.value)}
                ref={sendMessageRef}
                onFocus={_ => dispatch(new AllMessagesRead())}
                onKeyPress={e => e.key === 'Enter' ? sendMessage() : null}
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
