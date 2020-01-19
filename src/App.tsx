import React, {useState} from 'react';
import './App.css';
import {Chat} from "./chat/Chat";
import {StarredMessages} from "./starred-messages/StarredMessages";
import {Button, Grid} from "@material-ui/core";
import {useUrlSearchParams} from "use-url-search-params";
import {UserLoader} from "./user-loader/UserLoader";

function randUser() {
    return Math.round(Math.random() * 2);
}

function App() {
    // const [user] = useUrlSearchParams({userId: 0}, {userId: Number});
    const [displayUserLoader, setDisplayUserLoader] = useState(true);
    // const userId: number = Number(user.userId);
    return (
        <div>
            {/*<Grid container spacing={3}>*/}
            {/*    <Grid item xs={6}>*/}
            {/*        <Chat me={userId}/>*/}
            {/*    </Grid>*/}
            {/*    <Grid item xs={6}>*/}
            {/*        <StarredMessages me={userId}/>*/}
            {/*    </Grid>*/}
            {/*</Grid>*/}
            <Grid>
                <Button onClick = {_ => setDisplayUserLoader(!displayUserLoader)}>Toggle component</Button>
                {displayUserLoader && <UserLoader />}
            </Grid>
        </div>
    )
}

export default App;
