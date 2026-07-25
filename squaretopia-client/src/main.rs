use bevy::prelude::*;
use serde::Deserialize;
 
// --- Settings (these move into a config file in a later step) ---
const BASE_URL: &str = "http://localhost:3000";
const USERNAME: &str = "coolio"; // change to an account that exists in your DB
const MOVE_SPEED: f32 = 300.0;
 
// Labels the square so the movement system can find it.
#[derive(Component)]
struct Player;
 
// The validated profile, stored so any system can read it.
#[derive(Resource)]
struct PlayerProfile {
    username: String,
    color: Color,
}
 
// Exactly the shape the backend's /api/player/:username route returns.
// Both fields are Option on purpose: a missing field becomes a case we
// handle, not a crash. This is the fix for the Milestone One finding where
// the old client read json.username and json.color assuming they existed.
#[derive(Deserialize)]
struct ProfileResponse {
    username: Option<String>,
    color: Option<String>,
}
 
fn main() {
    unsafe {
        std::env::set_var("WGPU_BACKEND", "vulkan");
    }
 
    // Fetch the profile before the window opens, then hand it to Bevy.
    let profile = fetch_profile(BASE_URL, USERNAME);
 
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
 
// Ask the backend for the player's profile. Never crashes: every failure
// path falls back to a default so the client always starts.
fn fetch_profile(base_url: &str, username: &str) -> PlayerProfile {
    let url = format!("{}/api/player/{}", base_url, username);
    println!("[net] GET {url}");
 
    let default_color = Color::srgb(0.21, 0.60, 0.86);
 
    // The request. On localhost a missing server fails instantly.
    let mut response = match ureq::get(&url).call() {
        Ok(r) => r,
        Err(e) => {
            eprintln!("[net] request failed ({e}); using defaults.");
            return PlayerProfile { username: username.to_string(), color: default_color };
        }
    };
 
    // Read the body as text, then parse it ourselves with serde_json.
    let body = match response.body_mut().read_to_string() {
        Ok(b) => b,
        Err(e) => {
            eprintln!("[net] could not read body ({e}); using defaults.");
            return PlayerProfile { username: username.to_string(), color: default_color };
        }
    };
 
    let parsed: ProfileResponse = match serde_json::from_str(&body) {
        Ok(p) => p,
        Err(e) => {
            eprintln!("[net] invalid JSON ({e}); using defaults.");
            return PlayerProfile { username: username.to_string(), color: default_color };
        }
    };
 
    // Check each field before trusting it.
    let name = match parsed.username {
        Some(n) if !n.trim().is_empty() => n,
        _ => {
            eprintln!("[net] no username in response; using requested name.");
            username.to_string()
        }
    };
 
    let color = match parsed.color.as_deref().and_then(parse_hex_color) {
        Some(c) => c,
        None => {
            eprintln!("[net] no valid color in response; using default.");
            default_color
        }
    };
 
    println!("[net] loaded profile for '{name}'");
    PlayerProfile { username: name, color }
}
 
// Turn "#3498db" into a Bevy Color. Returns None for anything malformed,
// so a bad value from the database is a handled case, not a panic.
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
 
    // The square, in the color from the website. The name label is spawned as
    // a child so it automatically moves with the square.
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
}
 
// Reads WASD every frame and moves the player. delta_secs keeps speed
// consistent regardless of frame rate; normalize keeps diagonals fair.
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
 
