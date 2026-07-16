# Task Management API

A secure RESTful Task Management API built with Node.js, Express & MongoDB. Supports JWT authentication, full CRUD for tasks, validation, caching, and user ownership.

## Features

- User registration and login with JWT tokens
- Full CRUD operations for tasks (Create, Read, Update, Delete)
- Task ownership (users can only access their own tasks)
- Input validation using `express-validator`
- In-memory caching with `node-cache`
- MongoDB integration with Mongoose
- CORS enabled

## Tech Stack

- **Backend:** Node.js, Express
- **Database:** MongoDB + Mongoose
- **Auth:** JWT (jsonwebtoken)
- **Validation:** express-validator
- **Caching:** node-cache
- **Others:** dotenv, cors

## API Endpoints

### Authentication
- `POST /signup` — Register new user
- `POST /login` — Login and receive JWT token

### Tasks (Protected routes)
- `GET /tasks` — Get all user tasks
- `POST /tasks` — Create new task
- `GET /tasks/:id` — Get task by ID
- `PUT /tasks/:id` — Update task
- `DELETE /tasks/:id` — Delete task

### Misc
- `GET /health` — Health check

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   yarn install
