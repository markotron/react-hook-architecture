import React, {Reducer, useContext, useReducer, useState} from 'react';
import './App.css';
import {Chat} from "./chat/Chat";

function randUser() {
    return Math.round(Math.random() * 10000);
}

function App() {
    return <Chat me={randUser()}/>
}

export default App;
