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
