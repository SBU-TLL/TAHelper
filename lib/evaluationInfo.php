<?php
/**
 * Shared implementation — one copy serves every course.
 *
 * Reached only through a course entry point (www/<COURSE>/evaluationInfo.php),
 * which sets up $TAHELPER_DATA (that course's data directory, outside the web
 * root) and checks that the caller is on that course's staff list.
 */
$type = $_GET["type"];
$date = $_GET["date"];
// SECURITY: $filename builds the read/write path (file_get_contents / file_put_contents
// below). Sanitize to prevent path traversal / arbitrary file write — strip directory
// components and allow only safe filename characters.
$filename = preg_replace('/[^A-Za-z0-9_\-]/', '', basename($_GET["filename"] ?? ''));
$fn_arr = explode("_", $filename);

// $date = $fn_arr[0];
$evaluator_id = $fn_arr[0];
$group_id = $fn_arr[1];
if ($type == "student") {
  $student_id = $fn_arr[2];
}
// var_dump($date, $evaluator_id, $formid);
// $datenum = strtotime($date);
// print($datenum);

$template_file = "$TAHELPER_DATA/json/templates.json";
if (file_exists($template_file)) {
  $json_template = file_get_contents($template_file);
  $decoded_template = json_decode($json_template, true);
  // var_dump($template);
} else {
  echo "Template file doesn't exist";
  exit;
}

if ($type == "student") { /* Student Evaluation */
  $form_url = "$TAHELPER_DATA/studentResponses/$filename.json";
  $template = $decoded_template["Student Evaluation"];
} else {  /* Group Evaluation */
  $form_url = "$TAHELPER_DATA/groupResponses/$filename.json";
  $template = $decoded_template["Group Evaluation"];
}

if (!isset($_POST["data"])) { /* GET request */
  
  // if ($type == "student") {
  //   $fn_pattern = "studentResponses/*_$evaluator_id\_$formid.json";
  // } else {
  //   $fn_pattern = "groupResponses/*_$evaluator_id\_$formid.json";
  // }

  // // compare datetime of all existing form responses, return most recent response
  // $matched_files = glob($fn_pattern);
  // if (sizeof($matched_files) == 0) {
  //   print_r(json_encode($template));
  // } else {
  //   rsort($matched_files); // most recent response should now be in index 0
  //   $data = file_get_contents($matched_files[0]);
  //   $decoded_data = json_decode($data, true);
  //   if ($type == "student") {
  //     $form_data = $decoded_data["Student Evaluation"];
  //   } else {
  //     $form_data = $decoded_data["Group Evaluation"];
  //   }
  //   print(json_encode($form_data));
  // }

  if (file_exists($form_url)) {
    $data = file_get_contents($form_url);
    $decoded_data = json_decode($data, true);
    if ($type == "student") {
      $form_data = $decoded_data["Student Evaluation"];
    } else {
      $form_data = $decoded_data["Group Evaluation"];
    }
    print_r(json_encode($form_data));
  } else {
    print_r(json_encode($template));
  }

} else { /* POST request */

  $data = $_POST["data"];
  $form_details = $data["Details"];
  $form_data = $data["Response Data"];
  // var_dump($data, $form_details, $form_data);

  foreach ($form_data as $key => $value) {
    $template[$key]["Value"] = $value;
  }
  // print_r(json_encode($template));

  if ($type == "student") {
    $data = array(
      "Details" => array(
        "Date" => $date,
        "Evaluated By" => $evaluator_id,
        "Student Name" => str_replace('_', ' ', $form_details["Student Name"]),
        "Student NetID" => $student_id,
        "Group" => $group_id
      ), 
      "Student Evaluation" => $template
    );
  } else {
    $data = array(
      "Details" => array(
        "Date" => $date,
        "Evaluated By" => $evaluator_id,
        "Group" => $group_id
      ), 
      "Group Evaluation" => $template
    );
  }

  print_r(json_encode($data));
  file_put_contents($form_url, json_encode($data));
}
?>
