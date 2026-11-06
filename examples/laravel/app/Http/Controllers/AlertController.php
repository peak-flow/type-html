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
