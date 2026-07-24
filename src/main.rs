use bevy::prelude::*;

// One place to tune movement speed, in pixels per second.
const MOVE_SPEED: f32 = 300.0;

// A marker component. It holds no data; it just labels an entity as "the
// player" so a system can find that specific square and ignore everything else.
#[derive(Component)]
struct Player;

fn main() {
    unsafe {
        // Force Vulkan before Bevy starts. Auto-pick chose the AMD integrated
        // GPU and crashed; Vulkan routes to the discrete NVIDIA GPU.
        std::env::set_var("WGPU_BACKEND", "vulkan");
    }

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
        .add_systems(Startup, setup)
        // Update systems run every frame. `move_player` is where WASD is read.
        .add_systems(Update, move_player)
        .run();
}

fn setup(mut commands: Commands) {
    commands.spawn(Camera2d);

    commands.spawn((
        Sprite {
            color: Color::srgb(0.9, 0.3, 0.3),
            custom_size: Some(Vec2::splat(48.0)),
            ..default()
        },
        Transform::from_xyz(0.0, 0.0, 0.0),
        // Attach the Player label so move_player can find this square.
        Player,
    ));
}

// Runs every frame. Reads the keyboard and moves the player square.
//
// The parameters are how a system asks Bevy for what it needs:
//   - `time`: how long since the last frame. Multiplying movement by this makes
//     speed consistent regardless of frame rate.
//   - `keys`: the current keyboard state.
//   - `query`: access to entities. `Query<&mut Transform, With<Player>>` means
//     "give me the Transform (position) of every entity labeled Player, and let
//     me change it." Only our square matches, so we get just that one.
fn move_player(
    time: Res<Time>,
    keys: Res<ButtonInput<KeyCode>>,
    mut query: Query<&mut Transform, With<Player>>,
) {
    // Build a direction from the keys currently held. Start at zero (no input).
    let mut direction = Vec2::ZERO;

    if keys.pressed(KeyCode::KeyW) {
        direction.y += 1.0; // up
    }
    if keys.pressed(KeyCode::KeyS) {
        direction.y -= 1.0; // down
    }
    if keys.pressed(KeyCode::KeyA) {
        direction.x -= 1.0; // left
    }
    if keys.pressed(KeyCode::KeyD) {
        direction.x += 1.0; // right
    }

    // Normalizing makes diagonal movement the same speed as straight movement.
    // Without this, holding two keys would move ~1.4x faster. The check avoids
    // dividing by zero when no key is pressed.
    if direction != Vec2::ZERO {
        direction = direction.normalize();
    }

    // Apply the movement to the player's position. `get_single_mut` grabs the
    // one matching entity; if it isn't there for some reason we just skip.
    if let Ok(mut transform) = query.get_single_mut() {
        transform.translation.x += direction.x * MOVE_SPEED * time.delta_secs();
        transform.translation.y += direction.y * MOVE_SPEED * time.delta_secs();
    }
}
