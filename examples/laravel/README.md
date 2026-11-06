# Laravel example: Tiptap editor in Blade, saved to the database

Example files showing how the Tiptap editor from this demo would sit in a Laravel Blade form and be saved to an `alerts` table. This is **not a runnable app**: copy the files into an existing Laravel 11+ project at the same paths.

## Flow

1. `alerts/form.blade.php` renders a normal `<form>`. Alpine mounts Tiptap in a `<div>` and keeps a hidden `body` input in sync with `editor.getHTML()`.
2. The form POSTs (or PUTs) the title and HTML to `AlertController`.
3. The controller validates, then runs the HTML through **HTMLPurifier** using the same tag allowlist as `src/common.js`. Browser sanitizing alone is not enough, because anyone can post directly to the route.
4. The cleaned HTML is stored in `alerts.body`. `alerts/show.blade.php` outputs it with `{!! !!}`, which is safe only because it was purified on the way in.

## Files

| File | Purpose |
| --- | --- |
| `database/migrations/2026_11_05_000000_create_alerts_table.php` | `alerts` table: `title`, `body` (longText) |
| `app/Models/Alert.php` | Eloquent model |
| `app/Http/Controllers/AlertController.php` | create / store / show / edit / update, with server-side sanitizing |
| `routes/web.php` | Resource route line to add to your routes |
| `config/purifier-alert-setting.php` | The `alert` HTMLPurifier profile to merge into `config/purifier.php` |
| `resources/js/alert-editor.js` | Alpine component wrapping Tiptap |
| `resources/views/alerts/form.blade.php` | Create/edit form with the editor |
| `resources/views/alerts/show.blade.php` | Displays the saved alert |

## Setup in your Laravel project

```sh
npm install @tiptap/core @tiptap/starter-kit alpinejs
composer require mews/purifier
php artisan vendor:publish --provider="Mews\Purifier\PurifierServiceProvider"
# Merge the 'alert' entry from config/purifier-alert-setting.php into config/purifier.php 'settings'
php artisan migrate
```

Add `resources/js/alert-editor.js` to the `input` array in `vite.config.js`, then run `npm run dev` and open `/alerts/create`.

## Notes

- **Livewire apps:** Livewire 3+ already starts Alpine. Delete the last two lines of `alert-editor.js` (`window.Alpine = Alpine; Alpine.start();`) and keep the rest.
- **Empty messages:** an empty Tiptap document serializes as `<p></p>`. The component sends `''` instead, so `required` fails. The controller also rejects HTML that purifies down to nothing.
- **Custom Alpine editor:** to use this repo's custom engine instead of Tiptap, swap the `Editor` setup for `src/custom-editor.js`. The form, hidden input, controller, and purifier profile stay the same.
- **Styling and auth** are left out to keep the example focused. Add your layout, CSS, and authorization (for example, a policy on `Alert`).
