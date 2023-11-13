import { $, button, div, h4, input, li, ul } from "../lib/pointlessly";

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type Todo = {
  id: number;
  title: string;
  completed: boolean;
  userId: number;
};

export const Todo = $<{ todo: Todo }>(({ todo }, { $signal, $bind }) => {
  const [checked, setChecked] = $signal(false);

  return li({ className: "flex gap-2" })(
    $bind(() => input({ type: "checkbox", checked: checked() })()),
    div({})(`${todo.id}: ${todo.title}`),
    button({ onClick: () => setChecked(!checked()) })("toggle")
  );
});

export const Todos = $((_, { $signal, $bind, $mount, $if, $for }) => {
  const [todos, setTodos] = $signal<Todo[]>([]);
  const [loading, setLoading] = $signal(false);
  const [greeting, setGreeting] = $signal("hello");

  $mount(() => {
    const fetchTodos = async () => {
      setLoading(true);
      await wait(1000);
      const response = await fetch(
        "https://jsonplaceholder.typicode.com/todos?_limit=20"
      );
      const data = await response.json();
      setTodos(data);
      setLoading(false);
    };

    fetchTodos();
  });

  return div({ className: "flex flex-col container mx-auto" })(
    div({ className: "flex gap-2" })(
      $bind(() => div({})(greeting())),
      button({ onClick: () => setGreeting("") })("reset")
    ),
    $if(() => loading())(
      div({})("loading..."),
      ul({ className: "flex flex-col " })($for(todos, (todo) => Todo({ todo })))
    )
  );
});

export const TodoTitled = $(() => {
  return div({ className: "container mx-auto" })(
    h4({ className: "text-2xl" })(`Your's todos`),
    Todos()
  );
});
