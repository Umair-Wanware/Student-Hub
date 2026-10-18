require("dotenv").config();

if (!process.env.JWT_SECRET) {
    throw new Error("JWT_SECRET is missing from .env");
}

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});