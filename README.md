# Morrowlog

A Vite + React + TypeScript blog frontend for the FastAPI service in `simple-blog-backend`.
backend service: https://github.com/neiltalavera/simple-blog-frontend

## Run locally

Start the FastAPI service on `http://127.0.0.1:8000`, then from this directory:

```sh
npm install
npm run dev
```

Open the Vite URL printed in the terminal. Vite proxies `/api/*` to the API service so local development does not depend on the backend's CORS allowlist.

## API features

- Register and log in; retrieve the current user and keep the bearer token in local storage.
- Browse posts with API pagination and client-side search; view individual posts.
- Create, edit, and delete posts (the API enforces post ownership).
- List and create comments; add or remove a post reaction.

The API does not return a comment author's username or the current user's reaction state. Comments therefore show the author ID, and a reaction's selected state is remembered in this browser after a successful reaction request.

## Checks

```sh
npm test
npm run build
```
