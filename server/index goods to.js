const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const mysql = require("mysql");

const app = express();
const PORT = 5000;

app.use(cors());
app.use(bodyParser.json());

// CONNECT TO DB TO SERVER
const db = mysql.createPool({
  host: "localhost",
  user: "root",
  password: "",
  database: "hoops_apps",
  // connectionLimit: 10,
});

// SELECT ALL
db.query("SELECT * FROM league_organizers", (error, results) => {
  if (error) throw error;
  console.log(results);
});

// ORGANIZER - QUERY
app.post("/organizer/checkUsername", (req, res) => {
  const { username } = req.body;
  const query_organizer = `SELECT * FROM league_organizers WHERE BINARY username = ?`;

  db.query(query_organizer, [username], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
      return;
    }

    if (results.length === 1) {
      res.json({
        message: results.length + " account found",
        isUserExist: results.length,
      });
    } else {
      res.json({
        message: "Username is available",
        isUserExist: results.length,
      });
    }
  });
});

// SIGN UP
app.post("/organizer/addAccount", (req, res) => {
  const username = req.body.username;
  const password = req.body.password;
  const sqlInsertOrganizer =
    "INSERT INTO league_organizers (username, password) VALUES (?, ?)";

  db.query(sqlInsertOrganizer, [username, password], (err, result) => {
    if (err) {
      console.log("error");
    } else {
      console.log(result);
      res.json({
        message: "Successfully Created",
      });
    }
  });
});

// QUERY TEAM NAME
app.post("/teams/checkTeamName", (req, res) => {
  const { teamName } = req.body;
  const queryTeam = `SELECT * FROM teams WHERE BINARY team_name = ?`;

  db.query(queryTeam, [teamName], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
      return;
    }

    if (results.length === 1) {
      res.json({
        message: "Team name already exists",
        isTeamExist: true,
      });
    } else {
      res.json({
        message: "Team name is available",
        isTeamExist: false,
      });
    }
  });
});

// ADD TEAM NAME
app.post("/teams/addTeam", (req, res) => {
  const { organizer_id, teamName } = req.body;
  const sqlInsertTeam =
    "INSERT INTO teams (organizer_id, team_name) VALUES (?, ?)";

  db.query(sqlInsertTeam, [organizer_id, teamName], (err, result) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
      return;
    }

    res.json({
      message: "Team added successfully",
      team_id: result.insertId, // Return the team_id
    });
  });
});

//  INSERT PLAYERS
app.post("/teams/addPlayers", (req, res) => {
  const teamId = req.body.teamId;
  const players = req.body.players;

  // Iterate through the players array and insert each player's data
  players.forEach((player) => {
    const { firstName, lastName, jerseyNum } = player;
    const sqlInsertPlayers =
      "INSERT INTO players_and_overall_stats (team, first_name, last_name, jersey_num) VALUES (?, ?, ?, ?)";

    db.query(
      sqlInsertPlayers,
      [teamId, firstName, lastName, jerseyNum],
      (err, result) => {
        if (err) {
          console.log("Error inserting player:", err);
        } else {
          const playerId = result.insertId; // Get the ID of the inserted player
          console.log("Player Registered with ID:", playerId);

          db.query(sqlCreatePlayerStatsTable, (err, result) => {
            if (err) {
              console.log("Error creating player stats table:", err);
            } else {
              console.log(`Stats table for Player ID ${playerId} created`);
            }
          });
        }
      }
    );
  });

  res.json({
    message: "Players Registered",
  });
});

// LOGIN & QUERY
app.post("/organizer/login", (req, res) => {
  const { username, password } = req.body;
  const query = `SELECT * FROM league_organizers WHERE BINARY username = ? AND BINARY password = ?`;

  db.query(query, [username, password], (err, results) => {
    if (err) {
      console.error(err);
      res.status(500).json({ message: "Server error" });
      return;
    }

    if (results.length === 1) {
      res.json({
        message: results.length + " account found",
        isUserExist: results.length,
        userId: results[0].organizer_id,
        organizer: results[0].username,
      });
    } else {
      res.json({
        message: "Invalid username / password",
        isUserExist: results.length,
      });
    }
  });
});

//  POPULATE TEAMS IN DROPDOWN
app.get("/teams", (req, res) => {
  const organizerId = req.query.organizer_id;
  const query = "SELECT * FROM teams WHERE organizer_id = ?";
  db.query(query, [organizerId], (err, results) => {
    if (err) {
      console.error("MySQL query error:", err);
      res.status(500).json({ error: "An error occurred" });
    } else {
      res.json(results);
    }
  });
});

// INSERT NEW GAME
app.post("/game/create-game", (req, res) => {
  const { team_a, team_b, orgID } = req.body;
  const query =
    "INSERT INTO games (team_a, team_b, organizer_id) VALUES (?, ?, ?)";
  db.query(query, [team_a, team_b, orgID], (err, result) => {
    if (err) {
      console.error("Error inserting data: " + err);
      res.status(500).send("Error inserting data");
      return;
    }
    res.status(200).json({
      message: "Match created",
    });
  });
});

// GET ALL NEXT GAME FOR A SPECIFIC ORGANIZER
app.get("/games-list", (req, res) => {
  const organizer_id = req.query.organizer_id || 0; // Use default value or handle invalid values
  const game_status = req.query.game_status || 0; // Use default value or handle invalid values

  const query = `
    SELECT g.*, 
           ta.team_name AS team_a_name,
           tb.team_name AS team_b_name
    FROM games g
    INNER JOIN teams ta ON g.team_a = ta.team_id
    INNER JOIN teams tb ON g.team_b = tb.team_id
    WHERE g.organizer_id = ? 
    AND g.status = ?
  `;

  db.query(query, [organizer_id, game_status], (err, results) => {
    if (err) {
      console.error("MySQL query error:", err);
      res.status(500).json({ error: "An error occurred" });
    } else {
      res.json(results);
    }
  });
});

// GET ALL TEAM DATA FOR A SPECIFIC GAME
app.get("/api/games/:game_id", (req, res) => {
  const { game_id } = req.params;
  const query = `
      SELECT
        games.*,
        teams.team_name AS team_a_name,
        teams2.team_name AS team_b_name
      FROM games
      LEFT JOIN teams ON games.team_a = teams.team_id
      LEFT JOIN teams AS teams2 ON games.team_b = teams2.team_id
      WHERE games.game_id = ?
    `;

  db.query(query, [game_id], (err, result) => {
    if (err) throw err;
    res.json(result);
  });
});

//  GET PLAYERS DATA USING TEAM ID
app.get("/players", (req, res) => {
  const teamA_id = req.query.teamA_id;
  const teamB_id = req.query.teamB_id;

  // Query the 'players_and_overall_stats' table to get player data for both teams
  const query = `
    SELECT *
    FROM players_and_overall_stats
    WHERE team_id IN (?, ?)
    ORDER BY CASE
      WHEN team_id = ? THEN 0
      WHEN team_id = ? THEN 1
      ELSE 2
    END
  `;

  db.query(query, [teamA_id, teamB_id, teamA_id, teamB_id], (err, results) => {
    if (err) {
      console.error("MySQL query error:", err);
      res.status(500).json({ error: "An error occurred" });
    } else {
      res.json(results);
    }
  });
});

app.listen(PORT, () => {
  console.log(`Server is running on PORT ${PORT}`);
});
