# Rich Text Alerts in Laravel

- [Introduction](#introduction)
- [Installation](#installation)
- [Configuration](#configuration)
    - [Sanitizing HTML](#sanitizing-html)
    - [Vite](#vite)
- [Database](#database)
    - [Migration](#migration)
    - [Model](#model)
- [Routing](#routing)
- [Controller](#controller)
- [The Editor Component](#the-editor-component)
    - [Tiptap](#tiptap)
    - [Custom Alpine Editor](#custom-alpine-editor)
- [Views](#views)
    - [The Form](#the-form)
    - [Displaying Saved Alerts](#displaying-saved-alerts)
- [Trying It Out](#trying-it-out)
- [Livewire](#livewire)
- [Security Notes](#security-notes)

<a name="introduction"></a>
## Introduction

This guide adds the alert editor from this repository to a Laravel application. Authors write formatted messages (bold, italic, headings, lists, and links) in a Blade form, and the HTML is saved to an `alerts` table through Eloquent.

You can choose either editor from the demo:

- **Tiptap**: the open-source package editor. It is more complete and is the recommended choice.
- **Custom Alpine**: the small handmade engine in `src/custom-editor.js`. It is lighter but has the prototype limits described in the main README.

Both editors use the same form, controller, model, and migration. Only the JavaScript file changes.

The flow is a plain HTML form:

1. Alpine mounts the editor inside the form and copies its HTML into a hidden `body` input as the author types.
2. The form submits `title` and `body` to `AlertController`.
3. The controller validates the input, **sanitizes the HTML on the server**, and saves it with Eloquent.
4. The show page outputs the stored HTML.

Every file in this guide is also in this folder, at the same path it would have in your application, so you can copy it directly.

<a name="installation"></a>
## Installation

These steps assume a Laravel 11 or newer application with Vite.

Install the editor packages with npm. For the custom Alpine editor, you only need `alpinejs`:

```shell
# Tiptap
npm install alpinejs @tiptap/core @tiptap/starter-kit

# Custom Alpine editor
npm install alpinejs
```

Install [HTMLPurifier for Laravel](https://github.com/mewebstudio/Purifier) to clean the HTML on the server, then publish its configuration file:

```shell
composer require mews/purifier

php artisan vendor:publish --provider="Mews\Purifier\PurifierServiceProvider"
```

<a name="configuration"></a>
## Configuration

<a name="sanitizing-html"></a>
### Sanitizing HTML

The editor posts raw HTML, and anyone can post to your route without using the editor, so the server must decide which HTML is allowed. Open `config/purifier.php` and add an `alert` profile inside the `settings` array. It allows exactly the tags the editor can produce, matching the browser-side allowlist in `src/common.js`:

```php
'settings' => [
    // ...existing profiles...

    'alert' => [
        'HTML.Doctype' => 'HTML 4.01 Transitional',
        'HTML.Allowed' => 'p,div,br,strong,b,em,i,h2,ul,ol,li,a[href|title]',
        'URI.AllowedSchemes' => ['http' => true, 'https' => true, 'mailto' => true],
        'AutoFormat.AutoParagraph' => false,
        'AutoFormat.RemoveEmpty' => true,
    ],
],
```

Anything else, such as `<script>`, `<img>`, `style` attributes, or `javascript:` links, is removed.

<a name="vite"></a>
### Vite

Add the editor script to the `input` array in `vite.config.js`. Use the file for the editor you chose:

```js
laravel({
    input: [
        'resources/css/app.css',
        'resources/js/app.js',
        'resources/js/alert-editor.js',          // Tiptap
        // 'resources/js/alert-editor-alpine.js', // or the custom Alpine editor
    ],
    refresh: true,
}),
```

<a name="database"></a>
## Database

<a name="migration"></a>
### Migration

Generate a model and migration with Artisan:

```shell
php artisan make:model Alert --migration
```

Open the new migration in `database/migrations` and define the table. The `body` column holds the sanitized HTML. It uses `longText` because MySQL's `TEXT` type stops at 64 KB:

```php
<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('alerts', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            // Already-sanitized HTML from the editor. longText because MySQL TEXT caps at 64 KB.
            $table->longText('body');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('alerts');
    }
};
```

Run the migration:

```shell
php artisan migrate
```

<a name="model"></a>
### Model

Make `title` and `body` mass assignable in `app/Models/Alert.php`:

```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Alert extends Model
{
    protected $fillable = [
        'title',
        'body',
    ];
}
```

<a name="routing"></a>
## Routing

Register a resource route in `routes/web.php`. This guide only needs the create, store, show, edit, and update actions:

```php
<?php

use App\Http\Controllers\AlertController;
use Illuminate\Support\Facades\Route;

Route::resource('alerts', AlertController::class)->only(['create', 'store', 'show', 'edit', 'update']);
```

This gives you the following routes:

| Verb | URI | Action | Route Name |
| --- | --- | --- | --- |
| GET | `/alerts/create` | create | `alerts.create` |
| POST | `/alerts` | store | `alerts.store` |
| GET | `/alerts/{alert}` | show | `alerts.show` |
| GET | `/alerts/{alert}/edit` | edit | `alerts.edit` |
| PUT/PATCH | `/alerts/{alert}` | update | `alerts.update` |

<a name="controller"></a>
## Controller

Generate the controller:

```shell
php artisan make:controller AlertController
```

Replace `app/Http/Controllers/AlertController.php` with the following. Both `store` and `update` go through `validatedAlertData`, which validates the request and then runs `body` through the `alert` purifier profile **before** Eloquent saves it:

```php
<?php

namespace App\Http\Controllers;

use App\Models\Alert;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;
use Mews\Purifier\Facades\Purifier;

class AlertController extends Controller
{
    public function create(): View
    {
        return view('alerts.form', ['alert' => new Alert()]);
    }

    public function store(Request $request): RedirectResponse
    {
        $alert = Alert::create($this->validatedAlertData($request));

        return redirect()->route('alerts.show', $alert)->with('status', 'Alert saved.');
    }

    public function show(Alert $alert): View
    {
        return view('alerts.show', ['alert' => $alert]);
    }

    public function edit(Alert $alert): View
    {
        return view('alerts.form', ['alert' => $alert]);
    }

    public function update(Request $request, Alert $alert): RedirectResponse
    {
        $alert->update($this->validatedAlertData($request));

        return redirect()->route('alerts.show', $alert)->with('status', 'Alert updated.');
    }

    /**
     * Browser-side DOMPurify can be bypassed by anyone posting directly to this route,
     * so the HTML is cleaned again here, against the same allowlist, before it is stored.
     */
    private function validatedAlertData(Request $request): array
    {
        $validated = $request->validate([
            'title' => ['required', 'string', 'max:255'],
            'body' => ['required', 'string', 'max:100000'],
        ]);

        $cleanBody = Purifier::clean($validated['body'], 'alert');

        // A body made only of disallowed markup cleans down to nothing; reject it rather than store an empty alert.
        if (trim(strip_tags($cleanBody)) === '') {
            throw ValidationException::withMessages(['body' => 'The message cannot be empty.']);
        }

        return [
            'title' => $validated['title'],
            'body' => $cleanBody,
        ];
    }
}
```

For example, if someone posts `<p>Hi <script>steal()</script><strong>team</strong></p>`, the database stores `<p>Hi <strong>team</strong></p>`.

<a name="the-editor-component"></a>
## The Editor Component

The editor is an Alpine component named `alertEditor`. It takes the starting HTML, mounts the editor into the element marked `x-ref="editor"`, and keeps a `body` property in sync with the editor's HTML. The form submits `body` through a hidden input.

Create **one** of the following files. Both expose the same `body`, `toggle()`, and `addLink()`, so the Blade form works with either.

<a name="tiptap"></a>
### Tiptap

Create `resources/js/alert-editor.js`:

```js
import Alpine from 'alpinejs';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';

// Same StarterKit setup as src/tiptap.js, so the editor can only produce tags the server allowlist keeps.
const extensions = [StarterKit.configure({
    heading: { levels: [2] },
    link: { openOnClick: false, autolink: false, linkOnPaste: false, HTMLAttributes: { target: null, rel: null } },
    blockquote: false, codeBlock: false, code: false, horizontalRule: false,
    strike: false, underline: false, trailingNode: false,
})];

document.addEventListener('alpine:init', () => {
    Alpine.data('alertEditor', (initialHtml) => {
        // Kept outside the returned object: Alpine wraps its data in a reactive Proxy, which breaks Tiptap internals.
        let editor = null;

        return {
            body: initialHtml,

            init() {
                editor = new Editor({
                    element: this.$refs.editor,
                    extensions,
                    content: initialHtml,
                    onUpdate: () => {
                        // An empty Tiptap document serializes as "<p></p>"; send '' so the required rule catches it.
                        this.body = editor.isEmpty ? '' : editor.getHTML();
                    },
                });
            },

            destroy() {
                editor?.destroy();
            },

            toggle(action) {
                const chain = editor.chain().focus();
                if (action === 'bold') chain.toggleBold();
                if (action === 'italic') chain.toggleItalic();
                if (action === 'heading') chain.toggleHeading({ level: 2 });
                if (action === 'bulletList') chain.toggleBulletList();
                if (action === 'orderedList') chain.toggleOrderedList();
                if (action === 'undo') chain.undo();
                if (action === 'redo') chain.redo();
                chain.run();
            },

            addLink() {
                if (editor.state.selection.empty) return;
                const url = window.prompt('Link URL (https://…)');
                if (!url) return;
                editor.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
            },
        };
    });
});

// Remove these two lines if your app already starts Alpine (for example, Livewire 3+ bundles and starts it).
window.Alpine = Alpine;
Alpine.start();
```

<a name="custom-alpine-editor"></a>
### Custom Alpine Editor

First copy the engine from this repository, `src/custom-editor.js`, to `resources/js/custom-editor.js` in your application. Then create `resources/js/alert-editor-alpine.js`.

The demo page normally provides plain-text paste and link URL checks, so this wrapper adds both:

```js
import Alpine from 'alpinejs';
// Copy src/custom-editor.js from this repo to resources/js/custom-editor.js in your Laravel app.
import { createCustomEditor } from './custom-editor.js';

// Same rule as safeURL in src/common.js: the server purifier would strip other schemes anyway,
// but rejecting them here tells the author immediately.
function safeLinkUrl(value) {
    try {
        const parsed = new URL(value);
        return ['http:', 'https:', 'mailto:'].includes(parsed.protocol) ? parsed.href : null;
    } catch {
        return null;
    }
}

// Registers the same 'alertEditor' component name and methods as alert-editor.js (Tiptap),
// so resources/views/alerts/form.blade.php works unchanged with either editor.
document.addEventListener('alpine:init', () => {
    Alpine.data('alertEditor', (initialHtml) => {
        // Kept outside Alpine's reactive Proxy, matching the Tiptap version.
        let editor = null;

        return {
            body: initialHtml,

            init() {
                const host = this.$refs.editor;
                editor = createCustomEditor(host, initialHtml, () => {
                    // An emptied contenteditable can still hold "<br>" or "<p><br></p>"; send '' so required fails.
                    this.body = editor.getText().trim() === '' ? '' : editor.getHTML();
                });

                // The custom engine does not handle paste itself (the demo's app.js does), so without this
                // a rich paste would insert arbitrary HTML into the editor.
                host.addEventListener('paste', (event) => {
                    event.preventDefault();
                    editor.insertText(event.clipboardData.getData('text/plain'));
                }, true);
                host.addEventListener('drop', (event) => event.preventDefault());
            },

            destroy() {
                editor?.destroy();
            },

            toggle(action) {
                editor.command(action);
            },

            addLink() {
                const url = safeLinkUrl(window.prompt('Link URL (https://…)') ?? '');
                if (!url) return;
                // Returns false when no text is selected; the custom engine needs a selection to link.
                editor.command('link', url);
            },
        };
    });
});

// Remove these two lines if your app already starts Alpine (for example, Livewire 3+ bundles and starts it).
window.Alpine = Alpine;
Alpine.start();
```

With the custom editor, bold, italic, and links need a text selection, list toggles apply to the whole list, and undo works from HTML snapshots.

<a name="views"></a>
## Views

<a name="the-form"></a>
### The Form

Create `resources/views/alerts/form.blade.php`. The same view handles creating and editing: `$alert->exists` decides the title, the form action, and whether to spoof a `PUT` request.

Note these lines:

- `@vite(...)` loads the editor. Change it to `resources/js/alert-editor-alpine.js` if you chose the custom editor.
- `x-data="alertEditor(@js(...))"` starts the component with the existing HTML. Laravel's `@js` directive encodes it safely as a JavaScript string. `old('body')` restores the author's text after a validation error.
- `<input type="hidden" name="body" :value="body">` is what actually gets submitted.

```blade
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $alert->exists ? 'Edit alert' : 'New alert' }}</title>
    @vite(['resources/js/alert-editor.js'])
</head>
<body>
<main>
    <h1>{{ $alert->exists ? 'Edit alert' : 'New alert' }}</h1>

    <form method="POST" action="{{ $alert->exists ? route('alerts.update', $alert) : route('alerts.store') }}">
        @csrf
        @if ($alert->exists)
            @method('PUT')
        @endif

        <label for="title">Title</label>
        <input id="title" name="title" type="text" value="{{ old('title', $alert->title) }}" required maxlength="255">
        @error('title') <p role="alert">{{ $message }}</p> @enderror

        {{-- @js safely encodes the stored HTML as a JavaScript string for the editor's initial content. --}}
        <div x-data="alertEditor(@js(old('body', $alert->body ?? '')))">
            <div role="toolbar" aria-label="Message formatting">
                <button type="button" @mousedown.prevent @click="toggle('bold')" aria-label="Bold"><strong>B</strong></button>
                <button type="button" @mousedown.prevent @click="toggle('italic')" aria-label="Italic"><em>I</em></button>
                <button type="button" @mousedown.prevent @click="toggle('heading')" aria-label="Heading">H₂</button>
                <button type="button" @mousedown.prevent @click="toggle('bulletList')" aria-label="Bullet list">• List</button>
                <button type="button" @mousedown.prevent @click="toggle('orderedList')" aria-label="Numbered list">1. List</button>
                <button type="button" @mousedown.prevent @click="addLink()" aria-label="Add link to selected text">↗ Link</button>
                <button type="button" @mousedown.prevent @click="toggle('undo')" aria-label="Undo">↶</button>
                <button type="button" @mousedown.prevent @click="toggle('redo')" aria-label="Redo">↷</button>
            </div>

            <div x-ref="editor" aria-label="Alert message"></div>

            {{-- The editor HTML is posted through this hidden field; the controller sanitizes it before saving. --}}
            <input type="hidden" name="body" :value="body">
        </div>
        @error('body') <p role="alert">{{ $message }}</p> @enderror

        <button type="submit">Save alert</button>
    </form>
</main>
</body>
</html>
```

`@mousedown.prevent` on the toolbar buttons stops a click from taking focus away from the editor, so the author's text selection stays in place.

<a name="displaying-saved-alerts"></a>
### Displaying Saved Alerts

Create `resources/views/alerts/show.blade.php`. Blade's `{{ }}` would escape the HTML and show the raw tags, so the body is printed with `{!! !!}`. That is safe here **only because** the controller purified it before saving:

```blade
<!doctype html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>{{ $alert->title }}</title>
</head>
<body>
<main>
    @if (session('status'))
        <p role="status">{{ session('status') }}</p>
    @endif

    <h1>{{ $alert->title }}</h1>

    {{-- Unescaped output is deliberate: body was cleaned by HTMLPurifier in AlertController before it was stored.
         Never use {!! !!} on HTML that reached the database any other way. --}}
    <article>{!! $alert->body !!}</article>

    <a href="{{ route('alerts.edit', $alert) }}">Edit</a>
</main>
</body>
</html>
```

<a name="trying-it-out"></a>
## Trying It Out

Start Vite and your application:

```shell
npm run dev
php artisan serve   # or open your Herd site
```

Visit `/alerts/create`, write a message, and click **Save alert**. You will be redirected to `/alerts/{id}`, and the row is in the database:

```shell
php artisan tinker
>>> App\Models\Alert::latest()->first()->body
=> "<h2>Scheduled maintenance</h2><p>Please <strong>save your work</strong> before 8 PM.</p>"
```

Click **Edit** to load the saved HTML back into the editor. Submitting saves through `update`.

<a name="livewire"></a>
## Livewire

Livewire 3 and newer already includes and starts Alpine. If your application uses Livewire:

1. Remove `import Alpine from 'alpinejs';` and the last two lines (`window.Alpine = Alpine;` and `Alpine.start();`) from your editor file. The `alpine:init` listener still registers the component.
2. Skip `alpinejs` in `npm install`.

The form in this guide is a normal POST form. To save through a Livewire component instead, bind the hidden input with `wire:model` or call `$wire.set('body', ...)` from `onUpdate`, and run the same `Purifier::clean($body, 'alert')` step before saving.

<a name="security-notes"></a>
## Security Notes

- **Always sanitize on the server.** The browser editors limit what authors can create, but a request can be sent without them. `Purifier::clean(..., 'alert')` in the controller is the real protection.
- **Only use `{!! !!}` on purified HTML.** If alert HTML reaches the database another way, such as an import, a seeder, or a raw query, purify it there too.
- **Authorization is not included.** Add a [policy](https://laravel.com/docs/authorization#creating-policies) or middleware so only the right users can create and edit alerts.
