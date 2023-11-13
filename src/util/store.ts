import { $signal } from "../lib/old/signal";

const [username, setUsername] = $signal<string | null>(null);

export const state = {
  username,
  setUsername,
};
