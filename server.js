require("dotenv").config();

if (!process.env.SESSION_SECRET || Buffer.byteLength(process.env.SESSION_SECRET) < 32) {
    throw new Error("SESSION_SECRET must be set to a random value of at least 32 bytes.");
}

const app = require("./src/app");

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});