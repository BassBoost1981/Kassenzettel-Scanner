import { useState } from "react";
import "./App.css";

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(`Hallo, ${name}! Willkommen beim Kassenzettel Scanner.`);
  }

  return (
    <main className="container">
      <h1>Kassenzettel Scanner</h1>

      <p>Willkommen beim Kassenzettel Scanner!</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Dein Name..."
        />
        <button type="submit">Begrüßung</button>
      </form>

      <p>{greetMsg}</p>
    </main>
  );
}

export default App;
