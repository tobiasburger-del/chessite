# Chess Companion

A chessgame catalog/soon to be analysing website built incrementally as part of a web development course. The project has grown week by week — starting from static HTML/CSS and evolving into a full-stack, database-driven, deployed application.

---
 
##  About

This project serves as both a **learning vehicle** and a **real-world chess companion**. Each phase of development aligns with the weekly course topics, allowing hands-on practice with each new concept.

Users are able to upload their games through a PGN parser which allows them to see their games in detail, and add/change notes. They can then interact with the DB also by deleting their games, making it possible for a user to apply all parts of CRUD to the site. 

Each of these users has their own, secured account with a hashed password and email. This means my site enables them to register, login, and log out. This includes the usage of session cookies.
 
Where I want to continue with this project:
Apart from all mentioned in this doc, I want users to have the ability to analyse their games and get a better understanding of their mistakes, and patterns that are most worth practicing.
With the goal of improving their learning curve as efficiently as possible.


## Tech Stack
- HTML, CSS, JS
- Node.js, Express.js, Render (web server)
- PostgreSQL
- GitHub

## How to use it 
1. When opening the site, the user will get to read the index page
2. The user then clicks either the games or import tab
3. The user will be able to register and then log in, which redirects the user to the games page
4. Here a new user can click the import game button or the tab in the nav bar to go the import page
5. On the import page a user will be able to paste the PGN of the chess game they want to view
6. This will redirect the user to the games page where they can view the game listed and also delete it
7. When the user then clicks on the game they just imported, it will redirect them to the details of their game
8. Here the user can view the history of moves, metadata and add/change/read autosaved notes to their game
9. When the user is finished, they have the ability to log out through the button at the left top in the navigation bar

##  How to run locally
set up a PostgreSQL database
configure the env file with the example listed below
npm install,
node server.js,
open http://localhost:3000

## example env
DATABASE_URL=
SESSION_SECRET=[a long string]
NODE_ENV=development

## How to deploy
1. find your web server
2. connect it to your github
3. set project with correct github repository
4. set correct environment variables and other settings
5. push the code to your github repository if necessary and its live!

##  Affiliated modules
This project is for educational purposes as part of the following courses:
- SE_19 Web Technologies Basics 
- SE_01 Software Development Basics
