import { createTeam } from "./action";

export default function CreateTeamPage() {
  return (
    <div>
      <h1>Create a Team</h1>

      <form action={createTeam}>
        <div>
          <label htmlFor="name">Team name</label>
          <input id="name" name="name" required />
        </div>

        <div>
          <label htmlFor="description">Description</label>
          <textarea id="description" name="description" />
        </div>

        <button type="submit">Create Team</button>
      </form>
    </div>
  );
}
