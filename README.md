## Highlights 

* Real time chat implemented with web sockets (Socket.IO).
* Messages are paginated. Initially you get 5 and then you can load more. 
* Ability to star messages. This feature shows how components can communicate via services using RxJS. 
* Allocating and releasing resorces properly. Implemented with the Hookback architecture.
  * For canceling http requests we use `axios-observable`.
* Explicit state and state transitions. And yes, sideeffect are also represented within the state. Implemented with Hookback architecture.
* State and Action exaustivness. Thanks to Typescript. 
* Who is typing feature. Implemented through web sockets. Two opitmizations are implemented as well: 
  * We're not emitting that the user is typing on every key press, we're throttling for 1 second instead. 
  * We don't say that the user stopped typing only after there isn't any text in the input field, but also if the user didn't enter any new characters for 5 seconds. 
  * Both these optimizations are built with RxJS. 
* We're automatically retrying requests that fail. We're using a simple retry strategy but we also implemented exponential backoff. Also implemented with RxJS. 
* Messages are marked as read and unread so that the user knows which massages are new. 


## How to run? 

* Run the [simple-chat-backend](https://github.com/markotron/simple-chat-backend). 
* In the root of this repo run `npm start`. 

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Available Scripts

In the project directory, you can run:

### `npm start`

Runs the app in the development mode.<br />
Open [http://localhost:3000](http://localhost:3000) to view it in the browser.

The page will reload if you make edits.<br />
You will also see any lint errors in the console.

### `npm test`

Launches the test runner in the interactive watch mode.<br />
See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information.

### `npm run build`

Builds the app for production to the `build` folder.<br />
It correctly bundles React in production mode and optimizes the build for the best performance.

The build is minified and the filenames include the hashes.<br />
Your app is ready to be deployed!

See the section about [deployment](https://facebook.github.io/create-react-app/docs/deployment) for more information.

### `npm run eject`

**Note: this is a one-way operation. Once you `eject`, you can’t go back!**

If you aren’t satisfied with the build tool and configuration choices, you can `eject` at any time. This command will remove the single build dependency from your project.

Instead, it will copy all the configuration files and the transitive dependencies (Webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own.

You don’t have to ever use `eject`. The curated feature set is suitable for small and middle deployments, and you shouldn’t feel obligated to use this feature. However we understand that this tool wouldn’t be useful if you couldn’t customize it when you are ready for it.

## Learn More

You can learn more in the [Create React App documentation](https://facebook.github.io/create-react-app/docs/getting-started).

To learn React, check out the [React documentation](https://reactjs.org/).
