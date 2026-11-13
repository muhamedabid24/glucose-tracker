export function validateProfile(values) {
  const profile = {
    name: values.name.trim(),
    age: values.age === "" ? null : Number(values.age),
    weight: values.weight === "" ? null : Number(values.weight),
  };
  const errors = {};
  if (!profile.name || profile.name.length > 100)
    errors.name = "Enter a name from 1 to 100 characters.";
  if (
    profile.age !== null &&
    (!Number.isInteger(profile.age) || profile.age < 0 || profile.age > 130)
  )
    errors.age =
      "Enter a whole-number age from 0 to 130 years, or leave it blank.";
  if (
    profile.weight !== null &&
    (!Number.isFinite(profile.weight) ||
      profile.weight <= 0 ||
      profile.weight > 500 ||
      Math.abs(profile.weight * 100 - Math.round(profile.weight * 100)) > 1e-8)
  )
    errors.weight =
      "Enter a weight above 0 and up to 500 kg, with at most two decimal places, or leave it blank.";
  return { profile, errors };
}
