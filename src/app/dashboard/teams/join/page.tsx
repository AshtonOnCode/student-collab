import { joinTeam } from "./actions";

export default function JoinTeamPage() {
  return (
    <div>
      <h1>Join a Team</h1>

      <form action={joinTeam}>
        <div>
          <label htmlFor="joinCode">Join Code</label>
          <input id="joinCode" name="joinCode" placeholder="Enter team code" required />
        </div>

        <button type="submit">Join Team</button>
      </form>
    </div>
  );
}
