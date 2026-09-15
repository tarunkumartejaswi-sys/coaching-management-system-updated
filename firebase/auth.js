import {
  getAuth,
  signInWithEmailAndPassword,
  signOut,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

import {
  initializeApp,
  getApps,
} from "firebase/app";

import app from "./config";

const auth = getAuth(app);

export const loginUser = async (email, password) => {
  return await signInWithEmailAndPassword(auth, email, password);
};

export const logoutUser = async () => {
  return await signOut(auth);
};

export const sendStudentPasswordReset = async (email) => {
  if (!email) throw new Error("Student email is required");
  return await sendPasswordResetEmail(auth, email);
};

const getSecondaryAuth = () => {
  const secondaryApp =
    getApps().find((item) => item.name === "StudentAccountApp") ||
    initializeApp(app.options, "StudentAccountApp");

  return getAuth(secondaryApp);
};

export const createStudentAccount = async (email, password) => {
  const secondaryAuth = getSecondaryAuth();

  try {
    const result =
      await createUserWithEmailAndPassword(
        secondaryAuth,
        email,
        password
      );

    await signOut(secondaryAuth);

    return result.user;
  } catch (error) {
    if (error?.code === "auth/email-already-in-use") {
      const result =
        await signInWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );

      const existingUser = result.user;
      await signOut(secondaryAuth);
      return existingUser;
    }

    throw error;
  }
};

export default auth;
