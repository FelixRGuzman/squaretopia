use bevy::prelude::*;
use serde::Deserialize;

// Settings (these will move into a config file on) 

const BASE_URL: &str = "http://localhost:3000";
const MOVE_SPEED: f32 = 300.0;

// Labels the square so the movement system can find it.

#[derive(Component)]
struct Player;

// The validated profile, stored so any system can read it. 
// is_guest is true when the client was NOT launched from the website with a real user.

#[derive(Resource)]
struct PlayerProfile {
    username: String,
    color: Color,
    is_guest: bool,
}

// Exactly the shape the backend's /api/player/:username route returns.
// Both fields are Option on purpose: a missing field becomes a case we handle, not a crash. 
// This is the fix for the Milestone One finding where the old client read json.username and json.color assuming they existed.

#[derive(Deserialize)]
struct ProfileResponse {
    username: Option<String>,
    color: Option<String>,
}

fn main() {
    unsafe {
        std::env::set_var("WGPU_BACKEND", "vulkan");
    }

    // Windows passes the squaretopia:// link as the first argument when the client is launched from the website.
    // Pulls the username, if there is no valid link, there is no logged-in user, so we open as a guest.

    let launched_user = std::env::args()
        .nth(1)
        .and_then(|arg| parse_launch_username(&arg));

    let profile = match launched_user {
        Some(username) => {
            println!("[launch] launched from website as: {username}");
            fetch_profile(BASE_URL, &username)
        }
        None => {
            println!("[launch] no user provided; opening as guest.");
            guest_profile()
        }
    };

    App::new()
        .add_plugins(DefaultPlugins.set(WindowPlugin {
            primary_window: Some(Window {
                title: "Squaretopia".to_string(),
                resolution: (960.0_f32, 540.0_f32).into(),
                ..default()
            }),
            ..default()
        }))
        .insert_resource(ClearColor(Color::srgb(0.06, 0.06, 0.08)))
        .insert_resource(profile)
        .add_systems(Startup, setup)
        .add_systems(Update, move_player)
        .run();
}

// The profile used when the client is opened directly, with no login (aka guest).

fn guest_profile() -> PlayerProfile {
    PlayerProfile {
        username: "Guest (not logged in)".to_string(),
        color: Color::srgb(0.5, 0.5, 0.5),
        is_guest: true,
    }
}

// Pulls the username out of a launch URL like "squaretopia://launch?username=coolio". 
// Returns none if the argument is not one of our links, so a unknown argument does not break anything.

fn parse_launch_username(arg: &str) -> Option<String> {
    if !arg.starts_with("squaretopia://") {
        return None;
    }
    // Grab everything after "username=", stopping at any following '&'.
    let after = arg.split("username=").nth(1)?;
    let name = after.split('&').next()?.trim();
    if name.is_empty() {
        None
    } else {
        // Undo the basic URL encoding for a space, just in case (basic error prevention).
        Some(name.replace("%20", " "))
    }
}

// Ask the backend for the player's profile. 
// Does not crash if the request or the data is bad, it falls back to a guest so the client always starts.

fn fetch_profile(base_url: &str, username: &str) -> PlayerProfile {
    let url = format!("{}/api/player/{}", base_url, username);
    println!("[net] GET {url}");

    // The request, on localhost a missing server fails instantly.
    let mut response = match ureq::get(&url).call() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[net] request failed ({e}); opening as guest.");
            return guest_profile();
        }
    };

    // Read the body as text, then parse it ourselves with serde_json (our rust lib).
    
    let body = match response.body_mut().read_to_string() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[net] could not read body ({e}); opening as guest.");
            return guest_profile();
        }
    };

    let parsed: ProfileResponse = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[net] invalid JSON ({e}); opening as guest.");
            return guest_profile();
        }
    };

    // Check each field before trusting it. 
    // A missing username here means the account was not found
    // in this cases we open as a guest instead of a hardcoded default username

    let name = match parsed.username {
        Some(n) if !n.trim().is_empty() => n,
        _ => {
            eprintln!("[net] no user found in response; opening as guest.");
            return guest_profile();
        }
    };

    let color = match parsed.color.as_deref().and_then(parse_hex_color) {
        Some(c) => c,
        None => {
            eprintln!("[net] no valid color in response; using default blue.");
            Color::srgb(0.21, 0.60, 0.86)
        }
    };

    println!("[net] loaded profile for '{name}'");
    PlayerProfile { username: name, color, is_guest: false }
}

// Turns web colors into a Bevy Color for client. 
// Returns None for anything unexpected for handling.

fn parse_hex_color(hex: &str) -> Option<Color> {
    let h = hex.trim().trim_start_matches('#');
    if h.len() != 6 {
        return None;
    }
    let r = u8::from_str_radix(&h[0..2], 16).ok()?;
    let g = u8::from_str_radix(&h[2..4], 16).ok()?;
    let b = u8::from_str_radix(&h[4..6], 16).ok()?;
    Some(Color::srgb(r as f32 / 255.0, g as f32 / 255.0, b as f32 / 255.0))
}

fn setup(mut commands: Commands, profile: Res<PlayerProfile>) {
    commands.spawn(Camera2d);

    // The square, in the color from the website. 
    // The name label is regarded as a child so it automatically moves with the square.

    commands
        .spawn((
            Sprite {
                color: profile.color,
                custom_size: Some(Vec2::splat(48.0)),
                ..default()
            },
            Transform::from_xyz(0.0, 0.0, 0.0),
            Player,
        ))
        .with_children(|parent| {
            parent.spawn((
                Text2d::new(profile.username.clone()),
                TextFont { font_size: 18.0, ..default() },
                TextColor(Color::WHITE),
                // Local position: 40px above the square's center.
                Transform::from_xyz(0.0, 40.0, 1.0),
            ));
        });

    // Works as a short status line in the corner so it shows whether a guest
    // or real user was loaded from the website or the client is running as a guest.
    // Can be tested with cargo run from cmd (guest), or from localhost for user.

    let status = if profile.is_guest {
        "Guest mode: launch from the website to load your account.".to_string()
    } else {
        format!("Logged in as {}.", profile.username)
    };

    commands.spawn((
        Text::new(status),
        TextFont { font_size: 15.0, ..default() },
        TextColor(Color::srgb(0.6, 0.6, 0.65)),
        Node {
            position_type: PositionType::Absolute,
            top: Val::Px(5.0),
            left: Val::Px(10.0),
            ..default()
        },
    ));
}

// Reads WASD every frame and moves the player.
// delta_secs keeps speed consistent regardless of fps
// normalize nerfs diagonals game speed glitch.

fn move_player(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mut query: Query<&mut Transform, With<Player>>,
) {
    let mut direction = Vec2::ZERO;
    if keys.pressed(KeyCode::KeyW) { direction.y += 1.0; }
    if keys.pressed(KeyCode::KeyS) { direction.y -= 1.0; }
    if keys.pressed(KeyCode::KeyA) { direction.x -= 1.0; }
    if keys.pressed(KeyCode::KeyD) { direction.x += 1.0; }

    if direction != Vec2::ZERO {
        direction = direction.normalize();
    }

    if let Ok(mut transform) = query.get_single_mut() {
        transform.translation.x += direction.x * MOVE_SPEED * time.delta_secs();
        transform.translation.y += direction.y * MOVE_SPEED * time.delta_secs();
    }
}