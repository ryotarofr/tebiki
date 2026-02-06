/* @refresh reload */
import { Navigate, Route, Router } from "@solidjs/router";
import { lazy } from "solid-js";
import { render } from "solid-js/web";
import App from "./App";

const Home = lazy(() => import("./pages/Home"));
const About = lazy(() => import("./pages/About"));

render(
	() => (
		<Router root={App}>
			<Route path="/" component={Home} />
			<Route path="/about" component={About} />
			<Route
				path="/dashboard"
				component={() => <Navigate href={`/dashboard/hoge`} />}
			/>
		</Router>
	),
	document.getElementById("root") as HTMLElement,
);
