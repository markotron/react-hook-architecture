import React, {Reducer, useContext, useReducer, useState} from 'react';
import './App.css';
import {Chat} from "./chat/Chat";

function randUser() {
    return Math.round(Math.random() * 2);
}

function App() {
    return (
        <div>
            <Chat me={randUser()}/>
        </div>
    )
}

export default App;
