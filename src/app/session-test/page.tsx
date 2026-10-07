import { auth } from "../../features/auth/auth";

export default async function TestSessionPage() {
  const session = await auth();

  return (
    <div>
      <p>User ID: {session?.user.id}</p>
      <p>Name: {session?.user.name}</p>
      <p>Email: {session?.user.email}</p>
    </div>
  );
}
