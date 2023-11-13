import { $, a, div } from "../lib/pointlessly";
import { id } from "../util/general";

const Links = () => {
  return [
    a({ className: "mr-4 hover:underline", href: "#" })("Home"),
    a({ className: "mr-4 hover:underline", href: "#" })("About"),
    a({ className: "mr-4 hover:underline", href: "#" })("Contact"),
    a({ className: "mr-4 hover:underline", href: "#" })(id()),
  ];
};

type NavbarProps = { sitename: string; username: string };

export const Navbar = $<NavbarProps>(({ sitename, username }) => {
  return div({ className: "bg-neutral-50 border-b border-neutral-200 h-16" })(
    div({ className: "container mx-auto h-full flex items-center" })(
      div({ className: "flex items-center" })(
        div({ className: "text-xl font-bold" })(
          `Welcome to ${sitename}, ${username || "Guest"}`
        )
      ),
      div({ className: "flex-grow" })(),
      div({ className: "flex items-center" })(...Links())
    )
  );
});
