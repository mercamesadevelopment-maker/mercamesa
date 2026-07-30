updateUser
updateUser(attributes, options)
Updates user data for a logged in user.

In order to use the updateUser() method, the user needs to be signed in first.
By default, email updates sends a confirmation link to both the user's current and new email. To only send a confirmation link to the user's new email, disable Secure email change in your project's email auth provider settings.

const { data, error } = await supabase.auth.updateUser({
  email: 'new@email.com'
})
Response:
{
  "data": {
    "user": {
      "id": "11111111-1111-1111-1111-111111111111",
      "aud": "authenticated",
      "role": "authenticated",
      "email": "example@email.com",
      "email_confirmed_at": "2024-01-01T00:00:00Z",
      "phone": "",
      "confirmed_at": "2024-01-01T00:00:00Z",
      "new_email": "new@email.com",
      "email_change_sent_at": "2024-01-01T00:00:00Z",
      "last_sign_in_at": "2024-01-01T00:00:00Z",
      "app_metadata": {
        "provider": "email",
        "providers": [
          "email"
        ]
      },
      "user_metadata": {
        "email": "example@email.com",
        "email_verified": false,
        "phone_verified": false,
        "sub": "11111111-1111-1111-1111-111111111111"
      },
      "identities": [
        {
          "identity_id": "22222222-2222-2222-2222-222222222222",
          "id": "11111111-1111-1111-1111-111111111111",
          "user_id": "11111111-1111-1111-1111-111111111111",
          "identity_data": {
            "email": "example@email.com",
            "email_verified": false,
            "phone_verified": false,
            "sub": "11111111-1111-1111-1111-111111111111"
          },
          "provider": "email",
          "last_sign_in_at": "2024-01-01T00:00:00Z",
          "created_at": "2024-01-01T00:00:00Z",
          "updated_at": "2024-01-01T00:00:00Z",
          "email": "example@email.com"
        }
      ],
      "created_at": "2024-01-01T00:00:00Z",
      "updated_at": "2024-01-01T00:00:00Z",
      "is_anonymous": false
    }
  },
  "error": null
}

Notes:
Sends a "Confirm Email Change" email to the new address. If Secure Email Change is enabled (default), confirmation is also required from the old email before the change is applied. To skip dual confirmation and apply the change after only the new email is verified, disable Secure Email Change in the Email Auth Provider settings.