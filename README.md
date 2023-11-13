# Pointlessly

A JS Library for building apps that nobody should ever use

## Goals

This was an exercise in answering the question, "How hard can it be". The answer was: "Hard".

The goals of this little project were to build a framework/library that satisfy the following:

1. No Compiler Step
2. Implement state-ui bindings
3. No virtual DOM -- bind directly to elements
4. Try to hot-swap elements where possible
5. Implement if conditions and for loops

## Outcome

What i built kinda works (I'm sure it's riddled with bugs and memory leaks) but follows a design pattern as follows,

### `div()`, `span()`, etc. -- Intrinsic Elements

```ts
const someElement = div({ className: "px-4 py-2" })(
  span()("Some text"),
  button({ onClick: () => console.log("hi") })("Click me")
);
```

`div()` is an example of an intrinsic element creator function, this returns a "Component" that contains the DOM element and various functions for internal rendering.

Intrinsic elements are technically curried functions, but the choice to have them be called twice, once for attributes and once again for children is solely to make the syntax look nice.

### `$()`-- The Component Creator

```ts
const MyComponent = $<Props>((props, toolkit) => {
  return div({ className: "text-2xl font-bold" })("Hello World!");
});
```

`$()` is used to instantiate a custom stateful component, wrap your render function in this to enable the use of the component toolkit. The first argument of the render function is your props, and the second is an object containing the toolkit.

In hindsight you probably don't need to tie the toolkit to an individual component but instead set some kind of global listener whilst the function is initialised and unset it once done.

This syntax is somewhat remeniscent of in that react's components are functions (at least in the age of hooks) and they're simply called using `React.createComponent(YourComponent, { ...props }, children)` which would probably provide similar context to what $ does.

### `$signal` -- Create reactive state

```ts
const MyComponent = $<Props>(({ initialName }, { $signal }) => {
  const [myName, setMyName] = $signal(initialName);

  return div({ className: "text-2xl font-bold" })(
    // below is **NOT** reactive
    `Hello ${myName()}`
  );
});
```

`$signal` creates a signal similar to React's useState or Solid's createSignal. This returns a touple of a getter and setter. The state of the $signal is scoped to this component and will remain through re-renders.

Signals are scoped to the Component, this allows for easy cleanup of listeners (see $bind, $if, $for) when a component's `.destroy()` is called.

### `$bind` -- Create reactive UI

```ts
const MyComponent = $<Props>(({ initialName }, { $signal, $bind }) => {
  const [myName, setMyName] = $signal(initialName);

  return div({ className: "flex flex-col" })(
    div({ className: "text-2xl" })("My Profile"),
    $bind(() => div({ className: "text-lg" })(`Hi ${myName()}`))
  );
});
```

`$bind` takes a callback of a render function that returns some kind of Component, whether that is Custom or Intrinsic (div, ul, span, etc.). Within $bind you can call $signal getters to make the return of the render function reactive, i.e. it gets re-rendered when the $signal's setter is called.

### `$if` -- Conditional Renderer

```ts
const MyComponent = $<Props>((
  { initialName }, { $signal, $bind, $if }
) => {
  const [myName, setMyName] = $signal(initialName)

  return (
    div({ className: 'flex flex-col' })(
      div({ className: 'text-2xl' })('My Profile'),
      $bind(() =>
        div({ className: 'text-lg' })(`Hi ${myName()}`)
      )
      $if(() => myName() === 'Steve')(
        div()("It's Steve!"),
        div()("Oh, you're not steve...")
      )
    )
  )
})
```

`$if` takes an argument of a callback to determine the truth state of the returned function. This returned function takes two arguments, the first being the state when the callback is true and the second being the callback being false. $if returning a function is simply for the purpose of making the syntax look nice, it keeps the condition above (usually) inline with the $if call, and allowing the results to be down below.

If doesn't cache the return result, it instead tracks whether the new result will mean a different component is rendered. Anything within the $if is responsible for its own reactivity with $bind or $for.

### `$for` -- Loops!

```ts
const MyFriends = $((_, { $signal, $if, $for }) => {
  const [friends, setFriends] = $signal([
    "jebediah",
    "bob",
    "bill",
    "valentina",
  ]);

  return ul({ className: "flex flex-col" })(
    $if(() => friends().length === 0)(
      ul()("Wow... you have no friends..."),
      $for(friends, (friend) => li()(`Friend: ${friend}`))
    )
  );
});
```

`$for` is used for looping over a signal (or technically any getter function that returns an array) and returning the resulting elements created by the creator function. The first argument is the signal, and the second is the creator.

For is designed such that when the signal is updated, it will loop over the existing elements, check if they are of the same type (e.g. MyComponents vs. MyFriends) and either replace or re-render with new props. This means that any stateful components that are rendered by $for will maintain their state upon re-renders.

### Notes

Each `$` component (I ended up calling them "Dollar Sign Components") is tracked with a "serial number" when it's created. The rendering engine uses this serial to compare components and see if a re-render with new props is possible or not.

To be consistant each component is responsible for rendering and re-rendering it's children. Previous iterations in the src/lib/old folder had a mixed bag and this seemed the best approach to be unified.

### Rendering

As a result of the architecture the whole rendering of the application happens in two phases.

**Phase 1** is the "initialisation phase", where the Components are created and a large tree of "Component" types are generated, eventually culmunating in your root Component, here called App to be similar to React's conventions.

**Phase 2** occurs once the initialisation phase concludes and triggers what I call the "render cascade", where the root component calls `.render()` on it's children, who in turn call it on their children. Since everything is eventually made up of intrinsic components, each `.render()` call will _eventually_ lead to something getting added to the DOM.

**Phase 3** is the "live state" after the render cascade concludes, where each component tries its best to ensure it reacts properly to signal changes. This is where `rerender` functions come into play, since hot-swapping components instead of replacing large sections of the tree was desirable. Changes here will trigger a "re-render" cascade down the tree, which should hopefully result in minimal actual dom changes, but then again I didn't test this super thoroughly.

## Conclusion

Don't use this. If somehow you take inspiration from this and create something that actually works, please let me know, I'd love to see it.
