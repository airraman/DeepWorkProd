// In-memory stand-in for the parts of firebase-admin that index.js and
// pushTokens.js use. Not a full emulator: just enough Firestore (docs,
// subcollections, where/orderBy/limit, transactions), Auth (getUser,
// verifyIdToken) and Messaging (send) to run the real handlers in tests.

const Module = require("node:module");

const store = new Map(); // "a/b/c/d" -> data
const authUsers = new Map(); // uid -> {metadata: {creationTime}}
const idTokens = new Map(); // ID token string -> uid
const sent = [];
const messagingState = {send: null}; // optional override per test

const serverTimestamp = () => {
  const ms = Date.now();
  return {toMillis: () => ms};
};

function snapshot(path) {
  const data = store.get(path);
  return {id: path.split("/").pop(), exists: data !== undefined, data: () => data};
}

function docRef(path) {
  return {
    path,
    id: path.split("/").pop(),
    collection: (name) => collectionRef(`${path}/${name}`),
    get: async () => snapshot(path),
    set: async (data, opts) => {
      store.set(path, opts?.merge ? {...(store.get(path) || {}), ...data} : {...data});
    },
    delete: async () => {
      store.delete(path);
    },
  };
}

const OPS = {
  "==": (a, b) => a === b,
  ">=": (a, b) => a >= b,
  "<=": (a, b) => a <= b,
};

function collectionRef(path, query = {filters: []}) {
  const children = () => [...store.keys()]
      .filter((k) => k.startsWith(`${path}/`) && !k.slice(path.length + 1).includes("/"));
  return {
    doc: (id) => docRef(`${path}/${id}`),
    where: (field, op, value) => collectionRef(path,
        {...query, filters: [...query.filters, {field, op, value}]}),
    orderBy: (field, dir) => collectionRef(path, {...query, field, dir}),
    limit: (n) => collectionRef(path, {...query, limit: n}),
    get: async () => {
      let docs = children().map(snapshot)
          .filter((d) => query.filters.every((f) => OPS[f.op](d.data()[f.field], f.value)));
      if (query.field) {
        docs.sort((a, b) => (query.dir === "desc" ? -1 : 1) *
          (a.data()[query.field] - b.data()[query.field]));
      }
      if (query.limit) docs = docs.slice(0, query.limit);
      return {docs, empty: docs.length === 0, size: docs.length};
    },
  };
}

const firestoreFn = () => ({
  collection: (name) => collectionRef(name),
  runTransaction: async (fn) => fn({
    get: (ref) => ref.get(),
    set: (ref, data, opts) => ref.set(data, opts),
    delete: (ref) => ref.delete(),
  }),
});
firestoreFn.FieldValue = {serverTimestamp};

const fakeAdmin = {
  initializeApp: () => {},
  firestore: firestoreFn,
  auth: () => ({
    getUser: async (uid) => {
      if (!authUsers.has(uid)) throw new Error("auth/user-not-found");
      return authUsers.get(uid);
    },
    getUserByEmail: async (email) => {
      for (const [uid, record] of authUsers) {
        if (record.email === email) return {uid, ...record};
      }
      throw new Error("auth/user-not-found");
    },
    verifyIdToken: async (token) => {
      if (!idTokens.has(token)) throw new Error("auth/argument-error");
      return {uid: idTokens.get(token)};
    },
  }),
  messaging: () => ({
    send: async (message) => {
      if (messagingState.send) return messagingState.send(message);
      sent.push(message);
      return "msg-id";
    },
  }),
};

function reset() {
  store.clear();
  authUsers.clear();
  idTokens.clear();
  sent.length = 0;
  messagingState.send = null;
}

/**
 * require() a functions module with firebase-admin replaced by the fake.
 * @param {string} path
 * @return {*}
 */
function requireWithFakeAdmin(path) {
  const realLoad = Module._load;
  Module._load = function(request, ...rest) {
    if (request === "firebase-admin") return fakeAdmin;
    return realLoad.call(this, request, ...rest);
  };
  try {
    return require(path);
  } finally {
    Module._load = realLoad;
  }
}

module.exports = {
  fakeAdmin,
  store,
  authUsers,
  idTokens,
  sent,
  messagingState,
  reset,
  requireWithFakeAdmin,
};
