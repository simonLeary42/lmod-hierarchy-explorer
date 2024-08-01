/* I shall stobbournly ignore the javascript idiom of "return unefined when item not found"
and stick to my Python guns by raising an error */
class KeyError extends Error {
  constructor(message) {
    super(message);
    this.name = "KeyError";
  }
}
