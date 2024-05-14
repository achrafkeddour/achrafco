// script.js

const socket = io();
const chatMessages = document.getElementById('chat-messages');
const userList = document.getElementById('user-list');
const authenticationContainer = document.getElementById('authentication-container');
const chatContainer = document.getElementById('chat-container');

const usernameInput = document.getElementById('username-input');
const setUsernameButton = document.getElementById('set-username-button');
const messageInput = document.getElementById('message-input');
const sendButton = document.getElementById('send-button');

const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const showLoginLink = document.getElementById('show-login');
const showRegisterLink = document.getElementById('show-register');

let selectedUser = null;
let currentUser = null; // Store the current user's username
let messages = []; // Store all the messages

// Toggle between login and registration forms
showLoginLink.addEventListener('click', () => {
    loginForm.style.display = 'block';
    registerForm.style.display = 'none';
});

showRegisterLink.addEventListener('click', () => {
    registerForm.style.display = 'block';
    loginForm.style.display = 'none';
});

// Check authentication status
fetch('/auth-check')
    .then(response => response.json())
    .then(data => {
        if (data.authenticated) {
            authenticationContainer.style.display = 'none';
            chatContainer.style.display = 'block';
            currentUser = data.username; // Set the current user
            // Initialize the WebSocket connection
            initializeSocket();
            // Retrieve message history
            fetchMessages();
        }
    })
    .catch(error => console.error('Error checking authentication:', error));

// Fetch messages from the server
function fetchMessages() {
    fetch('/messages')
        .then(response => response.json())
        .then(data => {
            messages = data;
            displayConversation(selectedUser);
        })
        .catch(error => console.error('Error fetching messages:', error));
}

// Initialize WebSocket connection and handlers
function initializeSocket() {
    socket.on('connect', () => {
        console.log('Connected to server');
        socket.emit('setUsername', currentUser); // Set the username for this socket connection
    });

    socket.on('userJoined', (username) => {
        const userElement = document.createElement('div');
        userElement.className = 'list-group-item';
        userElement.innerText = username;
        userList.appendChild(userElement);
    });

    socket.on('private message', ({ sender, message }) => {
        messages.push({ sender, recipient: currentUser, content: message });
        if (selectedUser === sender) {
            const messageElement = document.createElement('div');
            messageElement.innerHTML = `<strong>[${sender}]:</strong> ${message}`;
            messageElement.classList.add('received-message', 'alert', 'alert-secondary', 'my-2', 'py-2', 'px-3', 'rounded');
            chatMessages.appendChild(messageElement);
        }
    });

    socket.on('userList', (users) => {
        userList.innerHTML = '<div class="list-group-item bg-primary text-white">Contacts</div>';
        users.forEach(user => {
            const userElement = document.createElement('div');
            userElement.className = 'list-group-item';
            userElement.innerText = user;
            userList.appendChild(userElement);
        });
    });

    socket.on('errorMessage', (error) => {
        alert(error);
    });

    socket.on('open conversation', (username) => {
        selectedUser = username;
        displayConversation(username);
    });
}

// Event listener for sending messages
sendButton.addEventListener('click', () => {
    const message = messageInput.value.trim();
    if (message !== '') {
        if (selectedUser) {
            // Display the sent message immediately
            displaySentMessage(currentUser, selectedUser, message);
            // Emit the message to the server
            socket.emit('private message', { recipient: selectedUser, message });
            // Add the message to the local messages array
            messages.push({ sender: currentUser, recipient: selectedUser, content: message });
            // Clear the message input
            messageInput.value = '';
        } else {
            alert('Please select a user to send a message.');
        }
    }
});

// Event listener for selecting a user from the list
userList.addEventListener('click', (event) => {
    const target = event.target;

    if (target && target.classList.contains('list-group-item')) {
        selectedUser = target.innerText.trim();
        displayConversation(selectedUser);
    }
});

// Function to display a sent message immediately
function displaySentMessage(sender, recipient, message) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>[You to ${recipient}]:</strong> ${message}`;
    messageElement.classList.add('sent-message', 'alert', 'alert-primary', 'my-2', 'py-2', 'px-3', 'rounded');
    chatMessages.appendChild(messageElement);
}

// Function to display conversation with a selected user or create a new one if it doesn't exist
function displayConversation(username) {
    // Clear chat messages
    chatMessages.innerHTML = '';

    // Display conversation header
    const conversationHeader = document.createElement('div');
    conversationHeader.innerHTML = `<h3 class="mb-0">Conversation with ${username}</h3>`;
    chatMessages.appendChild(conversationHeader);

    // Filter messages relevant to the selected user and display them
    const relevantMessages = messages.filter(message =>
        (message.sender === currentUser && message.recipient === username) ||
        (message.sender === username && message.recipient === currentUser)
    );

    relevantMessages.forEach(message => {
        const messageElement = document.createElement('div');
        if (message.sender === currentUser) {
            messageElement.innerHTML = `<strong>[You]:</strong> ${message.content}`;
        } else {
            messageElement.innerHTML = `<strong>[${message.sender}]:</strong> ${message.content}`;
        }
        messageElement.classList.add(message.sender === currentUser ? 'sent-message' : 'received-message', 'alert', message.sender === currentUser ? 'alert-primary' : 'alert-secondary', 'my-2', 'py-2', 'px-3', 'rounded');
        chatMessages.appendChild(messageElement);
    });
}
