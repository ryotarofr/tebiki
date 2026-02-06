import { invoke } from "@tauri-apps/api/core";
import { createSignal } from "solid-js";
import logo from "../assets/logo.svg";

function Home() {
	const [greetMsg, setGreetMsg] = createSignal("");
	const [name, setName] = createSignal("");

	async function greet() {
		setGreetMsg(await invoke("greet", { name: name() }));
	}

	return (
		<div>
			<h1>Welcome to Tauri + Solid</h1>

			<div class="row">
				<a href="https://vite.dev" target="_blank" rel="noopener noreferrer">
					<img src="/vite.svg" class="logo vite" alt="Vite logo" />
				</a>
				<a href="https://tauri.app" target="_blank" rel="noopener noreferrer">
					<img src="/tauri.svg" class="logo tauri" alt="Tauri logo" />
				</a>
				<a href="https://solidjs.com" target="_blank" rel="noopener noreferrer">
					<img src={logo} class="logo solid" alt="Solid logo" />
				</a>
			</div>
			<p>Click on the Tauri, Vite, and Solid logos to learn more.</p>

			<form
				class="row"
				onSubmit={(e) => {
					e.preventDefault();
					greet();
				}}
			>
				<input
					id="greet-input"
					onChange={(e) => setName(e.currentTarget.value)}
					placeholder="Enter a name..."
				/>
				<button type="submit">Greet</button>
			</form>
			<p>{greetMsg()}</p>
		</div>
	);
}

export default Home;
