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
