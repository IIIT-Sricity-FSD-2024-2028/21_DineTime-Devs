// Components own busy/error state; this ordinary closure blocks duplicate calls
// even before React has rendered busy=true.
export function createAction(setBusy, setError) {
  let inFlight = false;
  return async function run(action) {
    if (inFlight) return;
    inFlight = true;
    setBusy(true);
    setError("");
    try {
      return await action();
    } catch (cause) {
      setError(cause.message || "Something went wrong. Please try again.");
    } finally {
      inFlight = false;
      setBusy(false);
    }
  };
}
