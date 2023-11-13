import { Navbar } from "./components/Navbar";
import { Todos } from "./components/Todos";
import { $, div, input } from "./lib/pointlessly";

export const App = $((_, { $signal, $bind }) => {
  const [username, setUsername] = $signal("");

  return div({ className: "flex flex-col" })(
    $bind(() => Navbar({ sitename: "Todo App", username: username() })),
    input({ className: "border border-gray-400 p-2" })(),
    Todos()
  );
});