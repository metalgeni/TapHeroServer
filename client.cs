

[System.Serializable]
public class TournamentData
{
    public Tournament[] tournaments;
}

[System.Serializable]
public class Tournament
{
    public int id;
    public string name;
    public string start_date;
    public string end_date;
}

[System.Serializable]
public class PurchaseResponse
{
    public bool success;
    public string message;
    public int purchaseId;
}

// 사용자 정보 응답 클래스
[System.Serializable]
public class UserInformationResponse
{
    public int currentStage;
    public int gold;
}

// 응답 클래스
[System.Serializable]
public class DailyAttendanceResponse
{
    public bool success;
    public bool alreadyAttended;
    public int reward;
    public string message;
}

[System.Serializable]
public class BasicResponse
{
    public bool success;
    public string message;
}



public class ClickerGameManager : MonoBehaviour
{
    public Text messageText;
    public Text tournamentsText;

    private string serverUrl = "http://localhost:3000"; // Express 서버 주소

    void Start()
    {
        StartCoroutine(GetTournaments());
    }

    IEnumerator GetTournaments()
    {
        using (UnityWebRequest www = UnityWebRequest.Get($"{serverUrl}/tournaments"))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                TournamentData tournaments = JsonUtility.FromJson<TournamentData>(www.downloadHandler.text);

                if (tournaments != null && tournaments.tournaments != null)
                {
                    string tournamentList = "Tournaments:\n";

                    foreach (var tournament in tournaments.tournaments)
                    {
                        tournamentList += $"{tournament.name}\n";
                    }

                    tournamentsText.text = tournamentList;
                }
                else
                {
                    messageText.text = "No tournaments available.";
                }
            }
            else
            {
                messageText.text = "Failed to fetch tournaments.";
            }
        }
    }

    public void OnPurchaseButtonClicked()
    {
        StartCoroutine(PurchaseItem(1, "Power-up", 100));
    }

    IEnumerator PurchaseItem(int userId, string itemName, int price)
    {
        WWWForm form = new WWWForm();
        form.AddField("user_id", userId);
        form.AddField("item_name", itemName);
        form.AddField("price", price);

        using (UnityWebRequest www = UnityWebRequest.Post($"{serverUrl}/purchase", form))
        {
            yield return www.SendWebRequest();

            if (www.result == UnityWebRequest.Result.Success)
            {
                PurchaseResponse response = JsonUtility.FromJson<PurchaseResponse>(www.downloadHandler.text);

                if (response != null && response.success)
                {
                    messageText.text = $"Purchase successful! Purchase ID: {response.purchaseId}";
                }
                else
                {
                    messageText.text = "Failed to make a purchase.";
                }
            }
            else
            {
                messageText.text = "Failed to make a purchase.";
            }
        }
    }


    public void OnLoginButtonClicked()
    {
        StartCoroutine(LoginRequest(username, password));
    }
    
    public void OnLogoutButtonClicked()
    {
        StartCoroutine(LogoutRequest());
    }
    
    IEnumerator LogoutRequest()
    {
        using (UnityWebRequest www = UnityWebRequest.Post($"{serverUrl}/logout", new WWWForm()))
        {
            yield return www.SendWebRequest();
    
            if (www.result == UnityWebRequest.Result.Success)
            {
                messageText.text = "Logout successful!";
            }
            else
            {
                messageText.text = "Failed to logout.";
            }
        }
    }




    
    
    
    public void SaveUserInformation(int userId, int currentStage, int gold)
    {
        StartCoroutine(UpdateUserInformation(userId, currentStage, gold));
    }
    
    public void GetUserInformation(int userId)
    {
        StartCoroutine(GetUserInformation(userId));
    }
    
    IEnumerator UpdateUserInformation(int userId, int currentStage, int gold)
    {
        WWWForm form = new WWWForm();
        form.AddField("currentStage", currentStage);
        form.AddField("gold", gold);
    
        using (UnityWebRequest www = UnityWebRequest.Post($"{serverUrl}/user/{userId}/update", form))
        {
            yield return www.SendWebRequest();
    
            if (www.result == UnityWebRequest.Result.Success)
            {
                Debug.Log("User information updated successfully");
            }
            else
            {
                Debug.LogError("Failed to update user information");
            }
        }
    }
    
    IEnumerator GetUserInformation(int userId)
    {
        using (UnityWebRequest www = UnityWebRequest.Get($"{serverUrl}/user/{userId}/info"))
        {
            yield return www.SendWebRequest();
    
            if (www.result == UnityWebRequest.Result.Success)
            {
                UserInformationResponse response = JsonUtility.FromJson<UserInformationResponse>(www.downloadHandler.text);
    
                if (response != null)
                {
                    Debug.Log($"Current Stage: {response.currentStage}, Gold: {response.gold}");
                }
                else
                {
                    Debug.LogError("Failed to parse user information response");
                }
            }
            else
            {
                Debug.LogError("Failed to get user information");
            }
        }
    }

    public void CheckAttendance(int userId)
    {
        StartCoroutine(CheckAttendanceRequest(userId));
    }
    
    public void RequestRestart(int userId)
    {
        StartCoroutine(RequestRestartRequest(userId));
    }
    
    IEnumerator CheckAttendanceRequest(int userId)
    {
        using (UnityWebRequest www = UnityWebRequest.Post($"{serverUrl}/user/{userId}/checkAttendance", new WWWForm()))
        {
            yield return www.SendWebRequest();
    
            if (www.result == UnityWebRequest.Result.Success)
            {
                DailyAttendanceResponse response = JsonUtility.FromJson<DailyAttendanceResponse>(www.downloadHandler.text);
    
                if (response != null)
                {
                    if (response.success)
                    {
                        if (response.alreadyAttended)
                        {
                            Debug.Log("Already attended today.");
                        }
                        else
                        {
                            Debug.Log($"Attendance recorded. Reward: {response.reward} gold");
                        }
                    }
                    else
                    {
                        Debug.LogError($"Failed to check attendance. {response.message}");
                    }
                }
                else
                {
                    Debug.LogError("Failed to parse attendance response");
                }
            }
            else
            {
                Debug.LogError("Failed to check attendance.");
            }
        }
    }
    
    IEnumerator RequestRestartRequest(int userId)
    {
        using (UnityWebRequest www = UnityWebRequest.Post($"{serverUrl}/user/{userId}/requestRestart", new WWWForm()))
        {
            yield return www.SendWebRequest();
    
            if (www.result == UnityWebRequest.Result.Success)
            {
                BasicResponse response = JsonUtility.FromJson<BasicResponse>(www.downloadHandler.text);
    
                if (response != null && response.success)
                {
                    Debug.Log("Restart requested successfully");
                }
                else
                {
                    Debug.LogError($"Failed to request restart. {response?.message}");
                }
            }
            else
            {
                Debug.LogError("Failed to request restart.");
            }
        }
    }
    
    
}






