var settingToggles = [
  { name: 'Color-blind mode', setting: 'colorBlind', defaultValue: false },
  { name: 'Expand on mouse-over', setting: 'expandOnMouseOver', defaultValue: false },
  { name: 'Stretch images to fit square', setting: 'fitImagesToDiv', defaultValue: true },
]

window.Game = React.createClass({
  propTypes: {
    gameID: React.PropTypes.string,
  },

  getDefaultSettings: function () {
    var settings = {};
    settingToggles.forEach(function (s) {
      settings[s.setting] = s.defaultValue;
    });
    return settings;
  },

  getInitialSettings: function () {
    try {
      var settings = localStorage.getItem('settings');
      return JSON.parse(settings) || this.getDefaultSettings();
    } catch (e) {
      return this.getDefaultSettings();
    }
  },

  saveSettings: function (settings) {
    this.setState({ settings });
    try {
      localStorage.setItem('settings', JSON.stringify(settings));
    } catch (e) { }
  },

  getInitialState: function () {
    return {
      game: null,
      mounted: true,
      settings: this.getInitialSettings(),
      mode: 'game',
      codemaster: false,
      my_team: false,
    };
  },

  extraClasses: function () {
    var classes = '';
    if (this.state.settings.colorBlind) classes += ' color-blind';
    return classes;
  },

  handleKeyDown: function (e) {
    if (e.keyCode == 27) this.setState({ mode: 'game' });
  },

  componentWillMount: function () {
    window.addEventListener("keydown", this.handleKeyDown.bind(this));
    this.refresh();
  },

  componentWillUnmount: function () {
    window.removeEventListener("keydown", this.handleKeyDown.bind(this));
    this.setState({ mounted: false });
  },

  refresh: function () {
    if (!this.state.mounted) {
      return;
    }

    var refreshURL = '/game/' + this.props.gameID;
    if (this.state.game && this.state.game.state_id) {
      refreshURL = refreshURL + "?state_id=" + this.state.game.state_id;
    }

    $.get(refreshURL, (data) => {
      if (this.state.game && data.created_at != this.state.game.created_at) {
        this.setState({ codemaster: false });
      }
      this.setState({ game: data });
    });
    setTimeout(this.refresh, 3000);
  },

  toggleRole: function (e, role) {
    e.preventDefault();
    if (role === 'player' && this.state.codemaster) {
      alert("You've seen the board, you can't become a player now!");
      return;
    }

    this.setState({ codemaster: role == 'codemaster' });
  },

  guess: function (e, idx, word) {
    console.log('TEAM', this.state.game.winning_team);
    e.preventDefault();
    if (this.state.codemaster) {
      return; // ignore if codemaster view
    }
    if (this.state.game.revealed[idx]) {
      return; // ignore if already revealed
    }
    if (this.state.game.winning_team) {
      return; // ignore if game is over
    }
    if (!this.state.my_team) {
      alert("Pick a team first!");
      return;
    }
    if (this.state.my_team !== this.currentTeam()) {
      alert("Wait your turn!");
      return;
    }

    $.post('/guess', JSON.stringify({
      game_id: this.state.game.id,
      state_id: this.state.game.state_id,
      index: idx,
    }), (g) => { this.setState({ game: g }); });
  },

  currentTeam: function () {
    if (this.state.game.round % 2 == 0) {
      return this.state.game.starting_team;
    }
    return this.state.game.starting_team == 'red' ? 'blue' : 'red';
  },

  remaining: function (color) {
    var count = 0;
    for (var i = 0; i < this.state.game.revealed.length; i++) {
      if (this.state.game.revealed[i]) {
        continue;
      }
      if (this.state.game.layout[i] == color) {
        count++;
      }
    }
    return count;
  },

  endTurn: function () {
    $.post('/end-turn', JSON.stringify({
      game_id: this.state.game.id,
      state_id: this.state.game.state_id,
    }), (g) => { this.setState({ game: g }); });
  },

  nextGame: function (e) {
    e.preventDefault();
    $.post('/next-game', JSON.stringify({ game_id: this.state.game.id }),
      (g) => { this.setState({ game: g, codemaster: false, my_team: false }) });
  },

  toggleSettings: function (e) {
    if (e != null) e.preventDefault();
    if (this.state.mode == 'settings') {
      this.setState({ mode: 'game' });
    } else {
      this.setState({ mode: 'settings' });
    }
  },

  toggleSetting: function (e, setting) {
    if (e != null) e.preventDefault();
    var settings = { ...this.state.settings };
    if (settings[setting]) settings[setting] = false;
    else settings[setting] = true;
    this.saveSettings(settings);
  },

  chooseTeam: function (e) {
    const my_team = $(e.target).data('team');
    this.setState({ my_team });
  },

  resetTeam: function(e) {
    this.setState({ my_team: false });
  },

  render: function () {
    if (!this.state.game) {
      return (<p className="loading">Loading&hellip;</p>);
    }

    if (this.state.mode == 'settings') {
      return (
        <div className="settings">
          <div onClick={(e) => this.toggleSettings(e)} className="close-settings">
            <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M0 0L30 30M30 0L0 30" transform="translate(1 1)" stroke="black" stroke-width="2" />
            </svg>
          </div>
          <div className="settings-content">
            <h2>SETTINGS</h2>
            <div className="toggles">
              {settingToggles.map((toggle) => (
                <div className="toggle-set">
                  <div className="settings-label">
                    {toggle.name} <span className={'toggle-state'}>{this.state.settings[toggle.setting] ? 'ON' : 'OFF'}</span>
                  </div>
                  <div onClick={(e) => this.toggleSetting(e, toggle.setting)} className={this.state.settings[toggle.setting] ? 'toggle active' : 'toggle inactive'}>
                    <div className="switch"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }

    let status, statusClass;
    const my_team = this.state.my_team;
    const my_turn = my_team === this.currentTeam();

    if (this.state.game.winning_team) {
      statusClass = this.state.game.winning_team + ' win';
      status = this.state.game.winning_team + ' wins!';
      if (my_team) {
        status = my_team === this.state.game.winning_team
          ? "Your team won!"
          : "Your team lost!"
      }
    } else {
      statusClass = this.currentTeam();
      status = my_team && my_turn ? "Your turn": `${this.currentTeam()}'s turn`;
    }

    let teamOrStatus;
    if (!my_team) {
      teamOrStatus = (
        <div id="team-line">
          <div id="team-select-intro">
            Choose your team:
              </div>
          <div id="team-select-buttons">
            <button id="team-btn-blue" data-team="blue" onClick={this.chooseTeam}>Blue</button>
            <button id="team-btn-red" data-team="red" onClick={this.chooseTeam}>Red</button>
          </div>
        </div>
      )
    } else {
      teamOrStatus = (
        <div id="status-line" className={statusClass}>
          <div id="status" className="status-text">{status}</div>
        </div>
      )
    }

    let changeTeamButton;
    let teamSelected;
    if (my_team) {
      teamSelected = (<span id="team-selected" className={my_team}>You're On {my_team}</span>);
      changeTeamButton = (<button id="change-team-btn" onClick={this.resetTeam}>Change Team</button>);
    }

    let endTurnButton;
    if (!this.state.game.winning_team && !this.state.codemaster && my_turn) {
      endTurnButton = (<button onClick={(e) => this.endTurn(e)} id="end-turn-btn">End Your Turn</button>)
    }

    let otherTeam = 'blue';
    if (this.state.game.starting_team == 'blue') {
      otherTeam = 'red';
    }

    return (
      <div id="game-view" className={(this.state.codemaster ? "codemaster" : "player") + this.extraClasses()}>

        {teamOrStatus}

        <div id="button-line">
          <div id="remaining">
            <span className={this.state.game.starting_team + "-remaining"}>{this.remaining(this.state.game.starting_team)}</span>
            &nbsp;&ndash;&nbsp;
            <span className={otherTeam + "-remaining"}>{this.remaining(otherTeam)}</span>
          </div>

          {teamSelected}

          {changeTeamButton}

          {endTurnButton}

          <div className="clear"></div>
        </div>
        <div className="board">
          {this.state.game.words.map((w, idx) =>
            (
              <div for={idx}
                className={"cell " + (this.state.settings.expandOnMouseOver ? "expander " : "") + this.state.game.layout[idx] + " " + (this.state.game.revealed[idx] ? "revealed" : "hidden-word")}
                onClick={(e) => this.guess(e, idx, w)}
              >
                <img className={"imgcell " + (this.state.game.revealed[idx] ? "revealed" : "hidden-word")} style={{ objectFit: this.state.settings.fitImagesToDiv ? "fill" : "contain" }} src={w} />

                <img className={"overlay " + (this.state.codemaster ? "codemaster" : "player")} src={"other/" + (this.state.game.layout[idx]) + ".png"} />
              </div>
            )
          )}
        </div>
        <form id="mode-toggle" className={this.state.codemaster ? "codemaster-selected" : "player-selected"}>
          <a href="https://github.com/yenemy/codenames-pictures"><svg width="30" height="30" aria-labelledby="simpleicons-github-icon" role="img" viewBox="0 0 30 30" xmlns="http://www.w3.org/2000/svg"><title id="simpleicons-github-icon">GitHub icon</title><path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" /></svg></a>
          <button onClick={(e) => this.toggleSettings(e)} className="gear">
            <svg width="30" height="30" viewBox="0 0 35 35" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.3344 4.86447L24.31 8.23766C21.9171 9.80387 21.1402 12.9586 22.5981 15.4479C23.038 16.1989 23.6332 16.8067 24.3204 17.2543L22.2714 20.7527C20.6682 19.9354 18.6888 19.9151 17.0088 20.8712C15.3443 21.8185 14.3731 23.4973 14.2734 25.2596H10.3693C10.3241 24.4368 10.087 23.612 9.64099 22.8504C8.16283 20.3266 4.93593 19.4239 2.34593 20.7661L0.342913 17.3461C2.85907 15.8175 3.70246 12.5796 2.21287 10.0362C1.74415 9.23595 1.09909 8.59835 0.354399 8.14386L2.34677 4.74208C3.95677 5.5788 5.95446 5.60726 7.64791 4.64346C9.31398 3.69524 10.2854 2.0141 10.3836 0.25H14.267C14.2917 1.11932 14.5297 1.99505 15.0012 2.80013C16.4866 5.33635 19.738 6.23549 22.3344 4.86447ZM15.0038 17.3703C17.6265 15.8776 18.5279 12.5685 17.0114 9.97937C15.4963 7.39236 12.1437 6.50866 9.52304 8.00013C6.90036 9.4928 5.99896 12.8019 7.5154 15.391C9.03058 17.978 12.3832 18.8617 15.0038 17.3703Z" transform="translate(12.7548) rotate(30)" fill="#EEE" stroke="#BBB" stroke-width="0.5" />
            </svg>
          </button>
          <button onClick={(e) => this.toggleRole(e, 'player')} className="player">Player</button>
          <button onClick={(e) => this.toggleRole(e, 'codemaster')} className="codemaster">Spymaster</button>
          <button onClick={(e) => this.nextGame(e)} id="next-game-btn">New Game</button>
        </form>

        <div id="share">
          Send this link to friends: <a className="url" href={window.location.href}>{window.location.href}</a>
        </div>
      </div>
    );
  }
});
